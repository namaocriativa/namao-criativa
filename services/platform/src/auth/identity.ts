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
  leadId: string | null;
  customerId: string | null;
};

export const STAFF_ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
} as const;

export const CLIENT_ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  leadId: true,
  customerId: true,
} as const;

export function staffToJwt(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): JwtUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    typ: JWT_TYP.STAFF,
    leadId: null,
    customerId: null,
  };
}

export function clientAccountToJwt(account: {
  id: string;
  email: string;
  name: string;
  leadId: string | null;
  customerId: string | null;
}): JwtUser {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    role: USER_ROLE.CLIENT,
    typ: JWT_TYP.CLIENT,
    leadId: account.leadId,
    customerId: account.customerId,
  };
}
