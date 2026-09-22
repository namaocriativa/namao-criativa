export const DEFAULT_TENANT_ID = 'namao_default_tenant';
export const DEFAULT_TENANT_SLUG = 'namao';
export const DEFAULT_TENANT_NAME = 'Namão';

export const TENANT_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

export type TenantStatus = (typeof TENANT_STATUS)[keyof typeof TENANT_STATUS];
