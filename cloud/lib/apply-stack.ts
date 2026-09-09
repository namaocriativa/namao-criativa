import { createClientFromEnv } from './coolify-client.js';
import {
  loadEnv,
  loadStackConfig,
  log,
  requireSecret,
  resolveDatabaseUrl,
} from './config.js';
import { loadState, saveState } from './state.js';
import { applyEvolution } from '../stacks/evolution.js';
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

  const databaseUrl = resolveDatabaseUrl();
  log('apply', `PostgreSQL configured (${maskDatabaseUrl(databaseUrl)})`);

  state.evolution_postgres_password = requireSecret(
    'EVOLUTION_POSTGRES_PASSWORD',
    state.evolution_postgres_password,
  );
  state.evolution_api_key = requireSecret(
    'EVOLUTION_API_KEY',
    state.evolution_api_key,
  );
  state.environment_name =
    state.environment_name || stack.environment_name || 'production';

  log('apply', opts.dryRun ? 'dry-run (plan)' : 'applying stacks');

  state = await applyEvolution({
    client,
    stack,
    state,
    dryRun: opts.dryRun,
  });
  state = await applyRuntime({
    client,
    stack,
    state,
    dryRun: opts.dryRun,
  });

  if (!opts.dryRun) {
    saveState(state);
    log('apply', 'state.json written');
  }

  printWireHints(state, stack.evolution.instance);
  return state;
}

function maskDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '(set)';
  }
}

function printWireHints(
  state: {
    evolution_api_key: string;
  },
  instance: string,
) {
  console.log('\n--- Wire into services/platform/.env ---');
  console.log(
    `# After Evolution is reachable (public domain or Coolify internal URL):`,
  );
  console.log(`EVOLUTION_API_URL=<https://evolution... or Coolify proxy URL>`);
  console.log(`EVOLUTION_API_KEY=${state.evolution_api_key || '<from state>'}`);
  console.log(`EVOLUTION_INSTANCE=${instance}`);
  console.log(`PUBLIC_CHAT_API_ORIGIN=<https://api... when domain is ready>`);
  console.log('\n--- API DATABASE_URL ---');
  console.log(
    'namao-api uses a single PostgreSQL DATABASE_URL (Coolify Postgres or managed).\n',
  );
}
