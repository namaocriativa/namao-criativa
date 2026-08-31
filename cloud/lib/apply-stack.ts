import { createClientFromEnv } from './coolify-client.js';
import {
  loadEnv,
  loadStackConfig,
  log,
  requireSecret,
} from './config.js';
import { loadState, saveState } from './state.js';
import { applyMongodb } from '../stacks/mongodb.js';
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

  state.mongo_password = requireSecret(
    'MONGO_ROOT_PASSWORD',
    state.mongo_password,
  );
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

  state = await applyMongodb({
    client,
    stack,
    state,
    dryRun: opts.dryRun,
  });
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
  console.log(
    `PUBLIC_CHAT_API_ORIGIN=<https://runtime... when domain is ready>`,
  );
  console.log('\n--- Runtime DATABASE_URL ---');
  console.log(
    'Runtime shares the platform Prisma DB. Deploy platform to Coolify (phase 2)',
  );
  console.log(
    'or point DATABASE_URL at a reachable shared database. SQLite on localhost',
  );
  console.log('cannot be used by a remote runtime container.\n');
}
