import type { CoolifyClient } from './coolify-client.js';

type AppEnv = { uuid?: string; key?: string; value?: string };

async function listAppEnvs(
  client: CoolifyClient,
  appUuid: string,
): Promise<AppEnv[]> {
  const existing = await client.get<AppEnv[]>(`/applications/${appUuid}/envs`);
  return Array.isArray(existing) ? existing : [];
}

async function collapseDuplicateKeys(
  client: CoolifyClient,
  appUuid: string,
  key: string,
): Promise<void> {
  const matches = (await listAppEnvs(client, appUuid)).filter(
    (e) => e.key === key && e.uuid,
  );
  for (const dup of matches.slice(1)) {
    await client.delete(`/applications/${appUuid}/envs/${dup.uuid}`);
  }
}

/** Create or update application envs, patching by key and dropping duplicate keys. */
export async function upsertAppEnvs(
  client: CoolifyClient,
  appUuid: string,
  envs: Record<string, string>,
): Promise<void> {
  for (const [key, value] of Object.entries(envs)) {
    const matches = (await listAppEnvs(client, appUuid)).filter(
      (e) => e.key === key && e.uuid,
    );
    if (matches.length) {
      await client.patch(`/applications/${appUuid}/envs`, {
        key,
        value,
        is_literal: true,
      });
    } else {
      await client.post(`/applications/${appUuid}/envs`, {
        key,
        value,
        is_literal: true,
      });
    }
    await collapseDuplicateKeys(client, appUuid, key);
  }
}
