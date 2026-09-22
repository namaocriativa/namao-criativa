export const USER_ROLE = {
  CLIENT: 'CLIENT',
  ROOT: 'ROOT',
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const TENANT_STAFF_ROLES = [USER_ROLE.ADMIN, USER_ROLE.OPERATOR] as const;

export type TenantStaffRole = (typeof TENANT_STAFF_ROLES)[number];

export const STUDIO_ROLES = [
  USER_ROLE.ROOT,
  USER_ROLE.ADMIN,
  USER_ROLE.OPERATOR,
] as const;

export type StudioRole = (typeof STUDIO_ROLES)[number];

export const STUDIO_TOKEN_COOKIE = 'namao_studio_token';

export const ADMIN_TOKEN_COOKIE = 'namao_admin_token';

export const CLIENT_TOKEN_COOKIE = 'namao_client_token';

export function isStudioRole(
  role: string | null | undefined,
): role is StudioRole {
  return (
    role === USER_ROLE.ROOT ||
    role === USER_ROLE.ADMIN ||
    role === USER_ROLE.OPERATOR
  );
}

export function isTenantStaffRole(
  role: string | null | undefined,
): role is TenantStaffRole {
  return role === USER_ROLE.ADMIN || role === USER_ROLE.OPERATOR;
}

export function isStudioRoot(role: string | null | undefined): boolean {
  return role === USER_ROLE.ROOT;
}

export function isStudioAdmin(role: string | null | undefined): boolean {
  return role === USER_ROLE.ADMIN;
}

export type TenantAdminUser = {
  role: string | null | undefined;
  tenantId?: string | null;
};

export function isTenantAdmin(
  user: TenantAdminUser | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === USER_ROLE.ADMIN) return true;
  return user.role === USER_ROLE.ROOT && Boolean(user.tenantId);
}

export const STUDIO_PERMISSION = {
  IMAGES: 'images',
  VIDEOS: 'videos',
} as const;

export type StudioPermissionName =
  (typeof STUDIO_PERMISSION)[keyof typeof STUDIO_PERMISSION];

export type StudioPermissionUser = {
  role: string | null | undefined;
  tenantId?: string | null;
  canAccessImages?: boolean;
  canAccessVideos?: boolean;
};

export function canAccessImages(
  user: StudioPermissionUser | null | undefined,
): boolean {
  if (!user) return false;
  return isTenantAdmin(user) || user.canAccessImages === true;
}

export function canAccessVideos(
  user: StudioPermissionUser | null | undefined,
): boolean {
  if (!user) return false;
  return isTenantAdmin(user) || user.canAccessVideos === true;
}

export function hasStudioPermission(
  user: StudioPermissionUser | null | undefined,
  permission: StudioPermissionName,
): boolean {
  return permission === STUDIO_PERMISSION.IMAGES
    ? canAccessImages(user)
    : canAccessVideos(user);
}
