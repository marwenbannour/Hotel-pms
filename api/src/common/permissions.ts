export const ROLES = ['admin', 'reception', 'housekeeping', 'restaurant', 'accounting', 'it'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'reservations:read',
  'reservations:write',
  'frontdesk:operate',
  'availability:read',
  'guests:read',
  'guests:write',
  'guests:erase',
  'rooms:read',
  'rooms:write',
  'rooms:status',
  'reports:read',
  'admin:navigation',
  'admin:users',
  'billing:read',
  'billing:write',
  'billing:charge',
  'billing:override',
  'billing:export',
  'settings:billing',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Matrice RBAC (section 7 du cahier des charges). */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  reception: [
    'reservations:read', 'reservations:write', 'frontdesk:operate', 'availability:read',
    'guests:read', 'guests:write', 'rooms:read', 'rooms:status',
    'billing:read', 'billing:write', 'billing:charge',
  ],
  housekeeping: ['rooms:read', 'rooms:status'],
  // Facturation à la chambre (section 3.7) : le restaurant porte une consommation sur le compte du séjour.
  restaurant: ['guests:read', 'rooms:read', 'billing:charge'],
  accounting: [
    'reservations:read', 'guests:read', 'rooms:read', 'reports:read', 'availability:read',
    'billing:read', 'billing:write', 'billing:override', 'billing:export',
  ],
  it: ['rooms:read', 'rooms:write', 'admin:navigation', 'admin:users'],
};

/** Profils pour lesquels l'authentification forte est obligatoire (section 4.3). */
export const MFA_REQUIRED_ROLES: readonly Role[] = ['admin', 'accounting', 'it'];

export const permissionsOf = (role: Role): readonly Permission[] => ROLE_PERMISSIONS[role] ?? [];
