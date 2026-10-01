import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Permission, Role } from './permissions';

export interface AuthUser {
  id: string;
  role: Role;
  permissions: readonly Permission[];
  /** Vrai si le profil exige la MFA et que l'utilisateur ne l'a pas encore activée. */
  mfaEnrollmentRequired: boolean;
}

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_MFA_PENDING = 'allowMfaPending';
/** Route accessible même si l'utilisateur doit encore activer sa MFA. */
export const AllowMfaPending = () => SetMetadata(ALLOW_MFA_PENDING, true);

export const REQUIRED_PERMISSIONS = 'requiredPermissions';
export const RequirePermissions = (...perms: Permission[]) => SetMetadata(REQUIRED_PERMISSIONS, perms);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
