import { type CoolifyClient } from '../lib/coolify-client.js';
import type { StackConfig } from '../lib/config.js';
import { log, randomSecret } from '../lib/config.js';
import {
  databaseExists,
  findDatabaseByName,
} from '../lib/coolify-database.js';
import { resolveDestinationUuid } from '../lib/destination.js';
import {
  buildCoolifyPostgresUrl,
  managedDatabaseUrl,
} from '../lib/postgres-url.js';
import type { CloudState } from '../lib/state.js';

type DatabaseCreated = { uuid?: string; internal_db_url?: string };

export function postgresCredentials(
  state: CloudState,
  stack: StackConfig,
): { user: string; database: string; password: string } {
  const user =
    process.env.POSTGRES_USER?.trim() ||
    state.postgres_user ||
    stack.postgres.user;
  const database =
    process.env.POSTGRES_DB?.trim() ||
    state.postgres_db ||
    stack.postgres.database;
  const password =
    process.env.POSTGRES_PASSWORD?.trim() || state.postgres_password;
  if (!password) {
    throw new Error(
      'POSTGRES_PASSWORD is missing. Set it in cloud/.env (existing Coolify db) or re-run apply to generate one.',
    );
  }
  return { user, database, password };
}

export function resolveRuntimeDatabaseUrl(
  state: CloudState,
  stack: StackConfig,
): string {
  const managed = managedDatabaseUrl();
  if (managed) return managed;
  if (!state.postgres_database_uuid) {
    throw new Error(
      'Coolify Postgres has no uuid yet. Run apply (not plan) or set DATABASE_URL.',
    );
  }
  const { user, database, password } = postgresCredentials(state, stack);
  return buildCoolifyPostgresUrl({
    user,
    password,
    uuid: state.postgres_database_uuid,
    database,
  });
}

export function resolveEvolutionDatabaseUrl(
  state: CloudState,
  stack: StackConfig,
): string {
  const managed = managedDatabaseUrl();
  if (managed) {
    const joined = managed.includes('?')
      ? `${managed}&schema=evolution_api`
      : `${managed}?schema=evolution_api`;
    return joined;
  }
  if (!state.postgres_database_uuid) {
    throw new Error(
      'Coolify Postgres has no uuid yet. Run apply (not plan) or set DATABASE_URL.',
    );
  }
  const { user, database, password } = postgresCredentials(state, stack);
  return buildCoolifyPostgresUrl({
    user,
    password,
    uuid: state.postgres_database_uuid,
    database,
    schema: 'evolution_api',
  });
}

export async function applyPostgres(opts: {
  client: CoolifyClient;
  stack: StackConfig;
  state: CloudState;
  dryRun: boolean;
}): Promise<CloudState> {
  const { client, stack, dryRun } = opts;
  const state = { ...opts.state };

  state.destination_uuid = await resolveDestinationUuid(
    client,
    state.server_uuid,
    state.destination_uuid,
  );
  if (state.destination_uuid) {
    log('postgres', `destination uuid=${state.destination_uuid}`);
  } else {
    log(
      'postgres',
      'destination uuid unknown — Coolify will pick the server default',
    );
  }

  const managed = managedDatabaseUrl();
  if (managed) {
    log(
      'postgres',
      'DATABASE_URL override set — skipping Coolify Postgres resource',
    );
    return state;
  }

  if (state.postgres_database_uuid) {
    const exists = await databaseExists(client, state.postgres_database_uuid);
    if (!exists) {
      log(
        'postgres',
        `uuid=${state.postgres_database_uuid} missing — will recreate`,
      );
      state.postgres_database_uuid = '';
    }
  }

  if (!state.postgres_database_uuid) {
    const existing = await findDatabaseByName(client, stack.postgres.name);
    if (existing) {
      state.postgres_database_uuid = existing;
      log('postgres', `adopted existing uuid=${existing}`);
    }
  }

  const user =
    process.env.POSTGRES_USER?.trim() ||
    state.postgres_user ||
    stack.postgres.user;
  const database =
    process.env.POSTGRES_DB?.trim() ||
    state.postgres_db ||
    stack.postgres.database;
  let password =
    process.env.POSTGRES_PASSWORD?.trim() || state.postgres_password;
  if (!password && !state.postgres_database_uuid) {
    password = randomSecret();
  }
  if (!password) {
    throw new Error(
      `Coolify database "${stack.postgres.name}" exists (uuid=${state.postgres_database_uuid}) but POSTGRES_PASSWORD is empty. Set the existing password in cloud/.env, or set DATABASE_URL to skip Coolify Postgres.`,
    );
  }
  state.postgres_user = user;
  state.postgres_db = database;
  state.postgres_password = password;

  if (state.postgres_database_uuid) {
    log('postgres', `exists uuid=${state.postgres_database_uuid}`);
    return state;
  }

  const body: Record<string, unknown> = {
    name: stack.postgres.name,
    description: 'Namão API PostgreSQL',
    project_uuid: state.project_uuid,
    server_uuid: state.server_uuid,
    environment_name: state.environment_name,
    environment_uuid: state.environment_uuid || undefined,
    postgres_user: user,
    postgres_password: password,
    postgres_db: database,
    image: stack.postgres.image,
    is_public: false,
    instant_deploy: true,
  };
  if (state.destination_uuid) {
    body.destination_uuid = state.destination_uuid;
  }

  if (dryRun) {
    log(
      'postgres',
      `would CREATE ${stack.postgres.name} (${stack.postgres.image})`,
    );
    return state;
  }

  const created = await client.post<DatabaseCreated>(
    '/databases/postgresql',
    body,
  );
  if (!created?.uuid) {
    throw new Error('Coolify did not return postgres database uuid');
  }
  state.postgres_database_uuid = created.uuid;
  if (created.internal_db_url) {
    try {
      const parsed = new URL(created.internal_db_url);
      if (parsed.password) {
        state.postgres_password = decodeURIComponent(parsed.password);
        log('postgres', 'password synced from Coolify internal_db_url');
      }
    } catch {
      log('postgres', 'WARN: Coolify internal_db_url was not a valid URL');
    }
  }
  log('postgres', `created uuid=${created.uuid}`);
  return state;
}
