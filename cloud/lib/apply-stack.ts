import { createClientFromEnv } from './coolify-client.js';
import { loadEnv, loadStackConfig, log, requireSecret } from './config.js';
import { maskDatabaseUrl } from './postgres-url.js';
import { loadState, saveState } from './state.js';
import { applyEvolution } from '../stacks/evolution.js';
import {
  applyPostgres,
  resolveRuntimeDatabaseUrl,
} from '../stacks/postgres.js';
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

  state = await applyEvolution({
    client,
    stack,
    state,
    dryRun: opts.dryRun,
  });
  if (!opts.dryRun) saveState(state);

  state = await applyRuntime({
    client,
    stack,
    state,
    dryRun: opts.dryRun,
    databaseUrl,
  });
  if (!opts.dryRun) {
    saveState(state);
    log('apply', 'state.json written');
  }

  printWireHints(state, stack.evolution.instance, databaseUrl);
  return state;
}

function printWireHints(
  state: {
    evolution_api_key: string;
    postgres_database_uuid?: string;
  },
  instance: string,
  databaseUrl: string,
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
  if (state.postgres_database_uuid) {
    console.log(
      `namao-api uses Coolify Postgres ${state.postgres_database_uuid} (${maskDatabaseUrl(databaseUrl)}).`,
    );
  } else {
    console.log(
      `namao-api uses DATABASE_URL override (${maskDatabaseUrl(databaseUrl)}).`,
    );
  }
}
