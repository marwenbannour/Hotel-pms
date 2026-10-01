import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { authenticator } from 'otplib';
import { DataSource, IsNull } from 'typeorm';
import { AuditService } from '../../common/audit.service';
import { AccessTokenPayload } from '../../common/guards';
import { MFA_REQUIRED_ROLES } from '../../common/permissions';
import { ProblemException } from '../../common/problem';
import { appConfig } from '../../config';
import { RefreshToken, User } from '../../database/entities';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  mfaEnrollmentRequired: boolean;
}

export type LoginResult = TokenPair | { mfaRequired: true; mfaToken: string };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
// Empreinte factice pour garder un temps de réponse constant quand l'email est inconnu.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

authenticator.options = { window: 1 };

@Injectable()
export class AuthService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private users() {
    return this.ds.getRepository(User);
  }
  private tokens() {
    return this.ds.getRepository(RefreshToken);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users()
      .createQueryBuilder('u')
      .where('lower(u.email) = lower(:email)', { email })
      .getOne();
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.active) {
      await this.audit.log({ actorId: user?.id ?? null, action: 'auth.login_failed', entityType: 'user', entityId: user?.id, data: { email } });
      throw new ProblemException(401, 'INVALID_CREDENTIALS');
    }
    if (user.mfaEnabled) {
      const mfaToken = await this.jwt.signAsync({ sub: user.id, typ: 'mfa' }, { expiresIn: appConfig.jwt.mfaTtlSeconds });
      return { mfaRequired: true, mfaToken };
    }
    return this.issue(user, randomUUID());
  }

  async verifyMfa(mfaToken: string, code: string): Promise<TokenPair> {
    let sub: string;
    try {
      const p = await this.jwt.verifyAsync<{ sub: string; typ: string }>(mfaToken);
      if (p.typ !== 'mfa') throw new Error();
      sub = p.sub;
    } catch {
      throw new ProblemException(401, 'INVALID_TOKEN');
    }
    const user = await this.users().findOneBy({ id: sub, active: true });
    if (!user?.mfaEnabled || !user.mfaSecret) throw new ProblemException(401, 'INVALID_TOKEN');
    if (!authenticator.check(code, user.mfaSecret)) throw new ProblemException(401, 'MFA_INVALID_CODE');
    return this.issue(user, randomUUID());
  }

  /** Rotation : chaque jeton ne sert qu'une fois ; une réutilisation révoque toute la famille. */
  async refresh(raw: string): Promise<TokenPair> {
    const [id, secret] = raw.split('.');
    if (!id || !secret || !/^[0-9a-f-]{36}$/.test(id)) throw new ProblemException(401, 'INVALID_TOKEN');

    // La transaction renvoie un résultat au lieu de lever une erreur : en cas de réutilisation,
    // la révocation de la famille doit être validée en base avant de refuser la requête.
    const outcome = await this.ds.transaction(async (m) => {
      const token = await m.getRepository(RefreshToken).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!token || token.tokenHash !== sha256(secret)) return { error: 'invalid' as const };

      if (token.revokedAt) {
        await m.update(RefreshToken, { familyId: token.familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
        await this.audit.log(
          { actorId: token.userId, action: 'auth.refresh_reuse_detected', entityType: 'user', entityId: token.userId, data: { familyId: token.familyId } },
          m,
        );
        return { error: 'reused' as const };
      }
      if (token.expiresAt < new Date()) return { error: 'invalid' as const };

      const user = await m.getRepository(User).findOneBy({ id: token.userId, active: true });
      if (!user) return { error: 'invalid' as const };

      await m.update(RefreshToken, { id: token.id }, { revokedAt: new Date() });
      return { tokens: await this.issue(user, token.familyId, m.getRepository(RefreshToken)) };
    });

    if ('tokens' in outcome && outcome.tokens) return outcome.tokens;
    throw new ProblemException(
      401,
      'INVALID_TOKEN',
      'error' in outcome && outcome.error === 'reused' ? 'Jeton déjà utilisé : la session a été révoquée par sécurité.' : undefined,
    );
  }

  async logout(raw: string): Promise<void> {
    const [id, secret] = raw.split('.');
    if (!id || !secret || !/^[0-9a-f-]{36}$/.test(id)) return;
    const token = await this.tokens().findOneBy({ id });
    if (token && token.tokenHash === sha256(secret)) {
      await this.tokens().update({ familyId: token.familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
    }
  }

  async setupMfa(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.users().findOneByOrFail({ id: userId });
    if (user.mfaEnabled) throw new ProblemException(409, 'INVALID_STATE', 'La double authentification est déjà active.');
    const secret = authenticator.generateSecret();
    await this.users().update({ id: userId }, { mfaSecret: secret });
    return { secret, otpauthUrl: authenticator.keyuri(user.email, appConfig.hotel.name, secret) };
  }

  async enableMfa(userId: string, code: string): Promise<{ mfaEnabled: true; reloginRequired: true }> {
    const user = await this.users().findOneByOrFail({ id: userId });
    if (!user.mfaSecret) throw new ProblemException(409, 'INVALID_STATE', 'Appelez d’abord POST /v1/me/mfa/setup.');
    if (!authenticator.check(code, user.mfaSecret)) throw new ProblemException(422, 'MFA_INVALID_CODE');
    await this.users().update({ id: userId }, { mfaEnabled: true });
    // Les sessions ouvertes sans MFA sont révoquées.
    await this.tokens().update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.audit.log({ actorId: userId, action: 'auth.mfa_enabled', entityType: 'user', entityId: userId });
    return { mfaEnabled: true, reloginRequired: true };
  }

  private async issue(user: User, familyId: string, repo = this.tokens()): Promise<TokenPair> {
    const mfaEnrollmentRequired = MFA_REQUIRED_ROLES.includes(user.role) && !user.mfaEnabled;
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, typ: 'access', mfaEnrollmentRequired };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: appConfig.jwt.accessTtlSeconds });

    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + appConfig.jwt.refreshTtlDays * 86_400_000);
    const saved = await repo.save(repo.create({ userId: user.id, familyId, tokenHash: sha256(secret), expiresAt, revokedAt: null }));

    return {
      accessToken,
      refreshToken: `${saved.id}.${secret}`,
      tokenType: 'Bearer',
      expiresIn: appConfig.jwt.accessTtlSeconds,
      mfaEnrollmentRequired,
    };
  }
}
