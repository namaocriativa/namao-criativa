import type { CoolifyClient } from '../lib/coolify-client.js';
import type { StackConfig } from '../lib/config.js';
import { log, randomSecret } from '../lib/config.js';
import {
  databaseExists,
  findDatabaseByName,
} from '../lib/coolify-database.js';
import { buildCoolifyRedisUrl } from '../lib/postgres-url.js';
import type { CloudState } from '../lib/state.js';

type DatabaseCreated = { uuid?: string };

export function resolveRedisUrl(state: CloudState, db = 0): string {
  const fromEnv = process.env.REDIS_URL?.trim();
  if (fromEnv && db === 0) {
    try {
      const host = new URL(fromEnv).hostname;
      if (!['localhost', '127.0.0.1', '::1', 'redis'].includes(host)) {
        return fromEnv;
      }
    } catch {
      return fromEnv;
    }
  }
  if (!state.redis_database_uuid || !state.redis_password) {
    throw new Error(
      'Coolify Redis has no uuid/password yet. Run apply (not plan).',
    );
  }
  return buildCoolifyRedisUrl({
    password: state.redis_password,
    uuid: state.redis_database_uuid,
    db,
  });
}

export async function applyRedis(opts: {
  client: CoolifyClient;
  stack: StackConfig;
  state: CloudState;
  dryRun: boolean;
}): Promise<CloudState> {
  const { client, stack, dryRun } = opts;
  const state = { ...opts.state };

  if (state.redis_database_uuid) {
    const exists = await databaseExists(client, state.redis_database_uuid);
    if (!exists) {
      log('redis', `uuid=${state.redis_database_uuid} missing — will recreate`);
      state.redis_database_uuid = '';
    }
  }

  if (!state.redis_database_uuid) {
    const existing = await findDatabaseByName(client, stack.redis.name);
    if (existing) {
      state.redis_database_uuid = existing;
      log('redis', `adopted existing uuid=${existing}`);
    }
  }

  let password = process.env.REDIS_PASSWORD?.trim() || state.redis_password;
  if (!password && !state.redis_database_uuid) {
    password = randomSecret();
  }
  if (!password) {
    throw new Error(
      `Coolify database "${stack.redis.name}" exists (uuid=${state.redis_database_uuid}) but REDIS_PASSWORD is empty. Set it in cloud/.env or state.json.`,
    );
  }
  state.redis_password = password;

  if (state.redis_database_uuid) {
    log('redis', `exists uuid=${state.redis_database_uuid}`);
    return state;
  }

  const body: Record<string, unknown> = {
    name: stack.redis.name,
    description: 'Namão Redis — API cache + Evolution',
    project_uuid: state.project_uuid,
    server_uuid: state.server_uuid,
    environment_name: state.environment_name,
    environment_uuid: state.environment_uuid || undefined,
    redis_password: password,
    image: stack.redis.image,
    is_public: false,
    instant_deploy: true,
  };
  if (state.destination_uuid) {
    body.destination_uuid = state.destination_uuid;
  }

  if (dryRun) {
    log('redis', `would CREATE ${stack.redis.name} (${stack.redis.image})`);
    return state;
  }

  const created = await client.post<DatabaseCreated>('/databases/redis', body);
  if (!created?.uuid) {
    throw new Error('Coolify did not return redis database uuid');
  }
  state.redis_database_uuid = created.uuid;
  log('redis', `created uuid=${created.uuid}`);
  return state;
}
