import type { CoolifyClient } from './coolify-client.js';
import { log } from './config.js';

export type PersistentStorage = {
  uuid?: string;
  name?: string;
  mount_path?: string;
};

type StoragesPayload = {
  persistent_storages?: PersistentStorage[];
};

export const RUNTIME_STORAGE_MOUNT = '/app/services/platform/storage';
export const RUNTIME_STORAGE_NAME = 'namao-api-storage';

export function listPersistentMounts(body: unknown): PersistentStorage[] {
  if (Array.isArray(body)) {
    return body.filter(isPersistentStorage);
  }
  if (!body || typeof body !== 'object') return [];
  const nested = (body as StoragesPayload).persistent_storages;
  if (!Array.isArray(nested)) return [];
  return nested.filter(isPersistentStorage);
}

export function hasPersistentMount(
  body: unknown,
  mountPath: string,
): boolean {
  return listPersistentMounts(body).some((item) => item.mount_path === mountPath);
}

export async function ensurePersistentVolume(
  client: CoolifyClient,
  appUuid: string,
  opts: { name: string; mountPath: string; step: string },
): Promise<void> {
  const storages = await client.get<unknown>(
    `/applications/${appUuid}/storages`,
  );
  if (hasPersistentMount(storages, opts.mountPath)) return;
  await client.post(`/applications/${appUuid}/storages`, {
    type: 'persistent',
    name: opts.name,
    mount_path: opts.mountPath,
  });
  log(opts.step, `volume ${opts.mountPath} attached`);
}

function isPersistentStorage(value: unknown): value is PersistentStorage {
  return Boolean(value) && typeof value === 'object';
}
