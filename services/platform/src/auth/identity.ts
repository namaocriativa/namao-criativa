import { USER_ROLE } from './roles';

export const JWT_TYP = {
  STAFF: 'staff',
  CLIENT: 'client',
} as const;

export type JwtTyp = (typeof JWT_TYP)[keyof typeof JWT_TYP];

export type JwtUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  typ?: JwtTyp;
  tenantId: string | null;
  impersonatingTenantId?: string | null;
  tenantName?: string | null;
  leadId: string | null;
  customerId: string | null;
  canAccessImages?: boolean;
  canAccessVideos?: boolean;
};

export const STAFF_ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  tenantId: true,
  canAccessImages: true,
  canAccessVideos: true,
  tenant: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
} as const;

export const CLIENT_ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  tenantId: true,
  leadId: true,
  customerId: true,
} as const;

export function staffToJwt(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId?: string | null;
  impersonatingTenantId?: string | null;
  tenantName?: string | null;
  tenant?: { id: string; name: string; status: string } | null;
  canAccessImages?: boolean;
  canAccessVideos?: boolean;
}): JwtUser {
  const tenantId = user.tenantId ?? user.tenant?.id ?? null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    typ: JWT_TYP.STAFF,
    tenantId,
    impersonatingTenantId: user.impersonatingTenantId ?? null,
    tenantName: user.tenantName ?? user.tenant?.name ?? null,
    leadId: null,
    customerId: null,
    canAccessImages: user.canAccessImages === true,
    canAccessVideos: user.canAccessVideos === true,
  };
}

export function clientAccountToJwt(account: {
  id: string;
  email: string;
  name: string;
  tenantId?: string | null;
  leadId: string | null;
  customerId: string | null;
}): JwtUser {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: USER_ROLE.CLIENT,
    typ: JWT_TYP.CLIENT,
    tenantId: account.tenantId ?? null,
    leadId: account.leadId,
    customerId: account.customerId,
  };
}
