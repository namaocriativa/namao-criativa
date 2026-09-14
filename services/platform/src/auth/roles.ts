export const USER_ROLE = {
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export const STUDIO_ROLES = [USER_ROLE.ADMIN, USER_ROLE.OPERATOR] as const;

export type StudioRole = (typeof STUDIO_ROLES)[number];

export const STUDIO_TOKEN_COOKIE = 'namao_studio_token';

export const CLIENT_TOKEN_COOKIE = 'namao_client_token';

export function isStudioRole(role: string | null | undefined): role is StudioRole {
  return role === USER_ROLE.ADMIN || role === USER_ROLE.OPERATOR;
}

export function isStudioAdmin(role: string | null | undefined): boolean {
  return role === USER_ROLE.ADMIN;
}
