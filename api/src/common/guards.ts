import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { ALLOW_MFA_PENDING, AuthUser, IS_PUBLIC, REQUIRED_PERMISSIONS } from './auth.decorators';
import { Permission, permissionsOf, Role } from './permissions';
import { ProblemException } from './problem';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  typ: 'access';
  mfaEnrollmentRequired?: boolean;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new ProblemException(401, 'UNAUTHENTICATED');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new ProblemException(401, 'INVALID_TOKEN');
    }
    if (payload.typ !== 'access') throw new ProblemException(401, 'INVALID_TOKEN');

    const user: AuthUser = {
      id: payload.sub,
      role: payload.role,
      permissions: permissionsOf(payload.role),
      mfaEnrollmentRequired: !!payload.mfaEnrollmentRequired,
    };
    if (user.mfaEnrollmentRequired && !this.reflector.getAllAndOverride<boolean>(ALLOW_MFA_PENDING, targets)) {
      throw new ProblemException(403, 'MFA_REQUIRED', 'Activez la double authentification via POST /v1/me/mfa/setup.');
    }
    req.user = user;
    return true;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user || !required.every((p) => user.permissions.includes(p))) {
      throw new ProblemException(403, 'FORBIDDEN');
    }
    return true;
  }
}

/** En-têtes RateLimit-Limit / -Remaining / -Reset (section 22.8) au lieu de X-RateLimit-*. */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override headerPrefix = 'RateLimit';
}
