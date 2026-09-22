import { AsyncLocalStorage } from 'async_hooks';

export type TenantStore = {
  tenantId: string | null;
};

const storage = new AsyncLocalStorage<TenantStore>();

export function runWithTenant<T>(tenantId: string | null, fn: () => T): T {
  return storage.run({ tenantId }, fn);
}

export function getTenantContext(): TenantStore | undefined {
  return storage.getStore();
}

export function optionalTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}
