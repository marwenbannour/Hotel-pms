import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/auth.decorators';
import { MFA_REQUIRED_ROLES, Role } from '../../common/permissions';
import { invalidState, notFound, ProblemException } from '../../common/problem';
import { RefreshToken, User } from '../../database/entities';
import { CreateUserDto, UpdateUserDto } from './users.dto';

const BCRYPT_COST = 12;

/** Jamais le hash ni le secret MFA. */
export const toUserDto = (u: User) => ({
  id: u.id,
  email: u.email,
  fullName: u.fullName,
  role: u.role,
  locale: u.locale,
  active: u.active,
  mfaEnabled: u.mfaEnabled,
  mfaRequired: MFA_REQUIRED_ROLES.includes(u.role),
  createdAt: u.createdAt,
});

/**
 * Gestion des comptes (permission admin:users). Garde-fous :
 * - seul un administrateur peut créer, modifier ou attribuer le rôle admin (pas d'élévation par le profil IT) ;
 * - on ne peut ni se désactiver ni changer son propre rôle ;
 * - il reste toujours au moins un administrateur actif ;
 * - désactivation, changement de rôle, nouveau mot de passe et réinitialisation MFA ferment les sessions.
 */
@Injectable()
export class UsersService {
  constructor(@InjectDataSource() private readonly ds: DataSource, private readonly audit: AuditService) {}

  async list() {
    const users = await this.ds.getRepository(User).find({ order: { active: 'DESC', fullName: 'ASC' } });
    return { data: users.map(toUserDto), nextCursor: null };
  }

  async get(id: string) {
    return toUserDto(await this.find(this.ds.manager, id));
  }

  async create(dto: CreateUserDto, actor: AuthUser) {
    this.assertCanManageRole(actor, dto.role);
    return this.ds.transaction(async (m) => {
      const taken = await m.getRepository(User).createQueryBuilder('u').where('lower(u.email) = lower(:email)', { email: dto.email }).getExists();
      if (taken) throw new ProblemException(409, 'CONFLICT', 'Un compte existe déjà avec cette adresse email.');
      const user = await m.save(
        m.create(User, {
          email: dto.email.trim(),
          fullName: dto.fullName.trim(),
          role: dto.role,
          locale: dto.locale ?? 'fr',
          passwordHash: await bcrypt.hash(dto.password, BCRYPT_COST),
        }),
      );
      await this.audit.log({ actorId: actor.id, action: 'user.created', entityType: 'user', entityId: user.id, data: { email: user.email, role: user.role } }, m);
      return toUserDto(user);
    });
  }

  update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    return this.ds.transaction(async (m) => {
      const user = await this.find(m, id, true);
      this.assertCanManageRole(actor, user.role);
      if (dto.role) this.assertCanManageRole(actor, dto.role);

      const roleChanged = !!dto.role && dto.role !== user.role;
      const deactivated = dto.active === false && user.active;
      if (id === actor.id && (roleChanged || deactivated)) {
        throw invalidState('Vous ne pouvez pas modifier votre propre rôle ni désactiver votre propre compte.');
      }
      if (user.role === 'admin' && user.active && ((roleChanged && dto.role !== 'admin') || deactivated)) {
        await this.assertAnotherActiveAdmin(m, id);
      }

      const changes: Record<string, unknown> = {};
      for (const k of ['fullName', 'role', 'locale', 'active'] as const) {
        if (dto[k] !== undefined && dto[k] !== user[k]) changes[k] = k === 'fullName' ? dto.fullName!.trim() : dto[k];
      }
      if (!Object.keys(changes).length) return toUserDto(user);
      Object.assign(user, changes);
      const saved = await m.save(user);
      if (roleChanged || deactivated) await this.revokeSessions(m, id);
      await this.audit.log({ actorId: actor.id, action: 'user.updated', entityType: 'user', entityId: id, data: changes }, m);
      return toUserDto(saved);
    });
  }

  resetPassword(id: string, password: string, actor: AuthUser) {
    return this.ds.transaction(async (m) => {
      const user = await this.find(m, id, true);
      this.assertCanManageRole(actor, user.role);
      user.passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      await m.save(user);
      await this.revokeSessions(m, id);
      await this.audit.log({ actorId: actor.id, action: 'user.password_reset', entityType: 'user', entityId: id }, m);
      return toUserDto(user);
    });
  }

  /** Téléphone perdu : la personne réenrôlera la double authentification à sa prochaine connexion. */
  resetMfa(id: string, actor: AuthUser) {
    return this.ds.transaction(async (m) => {
      const user = await this.find(m, id, true);
      this.assertCanManageRole(actor, user.role);
      user.mfaEnabled = false;
      user.mfaSecret = null;
      await m.save(user);
      await this.revokeSessions(m, id);
      await this.audit.log({ actorId: actor.id, action: 'user.mfa_reset', entityType: 'user', entityId: id }, m);
      return toUserDto(user);
    });
  }

  private async find(m: EntityManager, id: string, lock = false) {
    const user = await m.findOne(User, { where: { id }, ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
    if (!user) throw notFound('Utilisateur');
    return user;
  }

  private assertCanManageRole(actor: AuthUser, role: Role) {
    if (role === 'admin' && actor.role !== 'admin') {
      throw new ProblemException(403, 'FORBIDDEN', 'Seul un administrateur peut gérer les comptes administrateur.');
    }
  }

  private async assertAnotherActiveAdmin(m: EntityManager, exceptId: string) {
    // Verrou sur les administrateurs actifs : deux retraits simultanés ne peuvent pas vider le rôle.
    const admins: { id: string }[] = await m.query(`SELECT id FROM users WHERE role = 'admin' AND active ORDER BY id FOR UPDATE`);
    if (!admins.some((a) => a.id !== exceptId)) throw invalidState('Il doit rester au moins un administrateur actif.');
  }

  private async revokeSessions(m: EntityManager, userId: string) {
    await m.update(RefreshToken, { userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
