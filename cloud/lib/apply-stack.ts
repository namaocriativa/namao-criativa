import { createCloudflareClientFromEnv } from './cloudflare-client.js';
import { createClientFromEnv, type CoolifyClient } from './coolify-client.js';
import { loadEnv, loadStackConfig, log, requireSecret } from './config.js';
import { resolveCoolifyPublicIp } from './coolify-public-ip.js';
import {
  ensureAddressRecord,
  parseHostname,
} from './pages-custom-domains.js';
import { maskDatabaseUrl } from './postgres-url.js';
import { loadState, saveState, type CloudState } from './state.js';
import { applyEvolution } from '../stacks/evolution.js';
import {
  applyPostgres,
  resolveRuntimeDatabaseUrl,
} from '../stacks/postgres.js';
import { applyRedis, resolveRedisUrl } from '../stacks/redis.js';
import { applyRuntime } from '../stacks/runtime.js';

export async function runApply(opts: { dryRun: boolean }) {
  loadEnv();
  const stack = loadStackConfig();
  const client = createClientFromEnv();
  let state = loadState();

  if (!state.server_uuid || !state.project_uuid) {
    throw new Error(
      'Missing server_uuid/project_uuid. Run: npm run bootstrap -w @namao/cloud',
    );
  }

  state.evolution_api_key = requireSecret(
    'EVOLUTION_API_KEY',
    state.evolution_api_key,
  );
  state.environment_name =
    state.environment_name || stack.environment_name || 'production';

  log('apply', opts.dryRun ? 'dry-run (plan)' : 'applying stacks');

  state = await applyPostgres({
    client,
    stack,
    state,
    dryRun: opts.dryRun,
  });
  if (!opts.dryRun) saveState(state);

  let databaseUrl: string;
  try {
    databaseUrl = resolveRuntimeDatabaseUrl(state, stack);
    log('apply', `PostgreSQL configured (${maskDatabaseUrl(databaseUrl)})`);
  } catch (err) {
    if (!opts.dryRun) throw err;
    databaseUrl = 'postgresql://namao:***@pending-coolify-uuid:5432/namao';
    log(
      'apply',
      'PostgreSQL would be created on apply; DATABASE_URL not resolved yet',
    );
  }

  state = await applyRedis({
    client,
    stack,
    state,
    dryRun: opts.dryRun,
  });
  if (!opts.dryRun) saveState(state);

  let redisUrl: string | undefined;
  try {
    redisUrl = resolveRedisUrl(state, 0);
    log('apply', `Redis configured (${maskDatabaseUrl(redisUrl)})`);
  } catch (err) {
    if (!opts.dryRun) throw err;
    log('apply', 'Redis would be created on apply; REDIS_URL not resolved yet');
  }

  state = await applyEvolution({
    client,
    stack,
    state,
    dryRun: opts.dryRun,
  });
  if (!opts.dryRun) saveState(state);

  const runtimeIp = await resolveRuntimePublicIp(client, state);

  state = await applyRuntime({
    client,
    stack,
    state,
    dryRun: opts.dryRun,
    databaseUrl,
    redisUrl,
  });
  if (!opts.dryRun) {
    saveState(state);
    await attachRuntimePublicDns({
      domain: stack.runtime.domain,
      ip: runtimeIp,
    });
    log('apply', 'state.json written');
  }

  printWireHints(state, stack.evolution.instance, databaseUrl);
  return state;
}

async function resolveRuntimePublicIp(
  client: CoolifyClient,
  state: CloudState,
): Promise<string> {
  let appFqdn = '';
  if (state.runtime_application_uuid) {
    try {
      const app = await client.get<{ fqdn?: string }>(
        `/applications/${state.runtime_application_uuid}`,
      );
      appFqdn = app.fqdn || '';
    } catch (err) {
      log(
        'runtime',
        `WARN: could not read API FQDN (${err instanceof Error ? err.message : err})`,
      );
    }
  }
  return resolveCoolifyPublicIp({
    envIp: process.env.COOLIFY_SERVER_PUBLIC_IP,
    appFqdn,
  });
}

async function attachRuntimePublicDns(opts: {
  domain: string;
  ip: string;
}): Promise<void> {
  const hostname = parseHostname(opts.domain);
  if (!hostname) return;
  if (!opts.ip) {
    log(
      'runtime',
      `skip DNS ${hostname}: set COOLIFY_SERVER_PUBLIC_IP or keep the Coolify sslip.io FQDN`,
    );
    return;
  }
  try {
    const cf = createCloudflareClientFromEnv();
    await ensureAddressRecord({
      client: cf,
      hostname,
      ip: opts.ip,
      proxied: false,
      step: 'runtime',
    });
  } catch (err) {
    log(
      'runtime',
      `WARN: DNS ${hostname}: ${err instanceof Error ? err.message : err}`,
    );
  }
}

function printWireHints(
  state: {
    evolution_api_key: string;
    postgres_database_uuid?: string;
    evolution_application_uuid?: string;
  },
  instance: string,
  databaseUrl: string,
) {
  console.log('\n--- Wire into services/platform/.env ---');
  console.log(
    `# After Evolution is reachable (public domain or Coolify sslip.io):`,
  );
  console.log(`EVOLUTION_API_URL=<https://evolution... or Coolify proxy URL>`);
  console.log(`EVOLUTION_API_KEY=${state.evolution_api_key || '<from state>'}`);
  console.log(`EVOLUTION_INSTANCE=${instance}`);
  console.log(`PUBLIC_CHAT_API_ORIGIN=<https://api... when domain is ready>`);
  console.log('\n--- API DATABASE_URL ---');
  if (state.postgres_database_uuid) {
    console.log(
      `namao-api uses Coolify Postgres ${state.postgres_database_uuid} (${maskDatabaseUrl(databaseUrl)}).`,
    );
    console.log(
      'Evolution uses the same instance with ?schema=evolution_api.',
    );
  } else {
    console.log(
      `namao-api uses DATABASE_URL override (${maskDatabaseUrl(databaseUrl)}).`,
    );
  }
}
