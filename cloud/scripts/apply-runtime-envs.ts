import { createClientFromEnv } from '../lib/coolify-client.js';
import { loadEnv, loadStackConfig, log } from '../lib/config.js';
import { loadState } from '../lib/state.js';
import { resolveRuntimeDatabaseUrl } from '../stacks/postgres.js';
import { resolveRedisUrl } from '../stacks/redis.js';
import { buildRuntimeEnvs } from '../stacks/runtime.js';

type AppEnv = { uuid?: string; key?: string };

async function main() {
  loadEnv();
  const stack = loadStackConfig();
  const state = loadState();
  const client = createClientFromEnv();
  const uuid = state.runtime_application_uuid;
  if (!uuid) throw new Error('state.json missing runtime_application_uuid');

  const databaseUrl = resolveRuntimeDatabaseUrl(state, stack);
  let redisUrl: string | undefined;
  try {
    redisUrl = resolveRedisUrl(state, 0);
  } catch {
    redisUrl = undefined;
  }
  const desired = buildRuntimeEnvs({ state, stack, databaseUrl, redisUrl });
  const existing = await client.get<AppEnv[]>(`/applications/${uuid}/envs`);
  const have = new Map(
    (Array.isArray(existing) ? existing : [])
      .filter((row): row is AppEnv & { key: string } => Boolean(row.key))
      .map((row) => [row.key, row]),
  );
  const publicKeys = new Set([
    'GITHUB_WEBSITES_ORG',
    'CLOUDFLARE_ACCOUNT_ID',
    'META_REDIRECT_URI',
    'META_GRAPH_VERSION',
    'PUBLIC_CHAT_API_ORIGIN',
    'NAMAO_PUBLIC_URL',
    'NAMAO_STUDIO_URL',
  ]);
  for (const [key, value] of Object.entries(desired)) {
    if (!have.has(key)) {
      await client.post(`/applications/${uuid}/envs`, {
        key,
        value,
        is_literal: true,
      });
      log('runtime-envs', `created ${key}`);
      continue;
    }
    if (publicKeys.has(key)) {
      await client.patch(`/applications/${uuid}/envs`, {
        key,
        value,
        is_literal: true,
      });
      log('runtime-envs', `updated ${key}=${value}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
