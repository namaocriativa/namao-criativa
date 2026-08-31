import type { CoolifyClient } from '../lib/coolify-client.js';
import { encodeComposeFile } from '../lib/encode.js';
import type { StackConfig } from '../lib/config.js';
import { log } from '../lib/config.js';
import type { CloudState } from '../lib/state.js';

type ServiceCreated = { uuid?: string; domains?: string[] };
type ServiceEnv = { uuid?: string; key?: string; value?: string };

export function mongoConnectionUrl(opts: {
  user: string;
  password: string;
  database: string;
  /** Coolify internal hostname for the mongodb service container */
  host?: string;
}): string {
  const host = opts.host || 'mongodb';
  const user = encodeURIComponent(opts.user);
  const pass = encodeURIComponent(opts.password);
  return `mongodb://${user}:${pass}@${host}:27017/${opts.database}?authSource=admin&replicaSet=rs0&directConnection=true`;
}

async function upsertServiceEnvs(
  client: CoolifyClient,
  serviceUuid: string,
  envs: Record<string, string>,
): Promise<void> {
  const existing = await client.get<ServiceEnv[]>(
    `/services/${serviceUuid}/envs`,
  );
  const byKey = new Map(
    (Array.isArray(existing) ? existing : [])
      .filter((e) => e.key)
      .map((e) => [e.key as string, e]),
  );

  for (const [key, value] of Object.entries(envs)) {
    const found = byKey.get(key);
    if (found?.uuid) {
      await client.patch(`/services/${serviceUuid}/envs`, {
        uuid: found.uuid,
        key,
        value,
        is_literal: true,
      });
    } else {
      await client.post(`/services/${serviceUuid}/envs`, {
        key,
        value,
        is_literal: true,
      });
    }
  }
}

export async function applyMongodb(opts: {
  client: CoolifyClient;
  stack: StackConfig;
  state: CloudState;
  dryRun: boolean;
}): Promise<CloudState> {
  const { client, stack, dryRun } = opts;
  const state = { ...opts.state };
  const user = process.env.MONGO_ROOT_USERNAME?.trim() || 'root';
  const password = state.mongo_password;
  const database = stack.mongodb.database;

  const envs = {
    MONGO_ROOT_USERNAME: user,
    MONGO_ROOT_PASSWORD: password,
    MONGO_DATABASE: database,
  };

  if (state.mongodb_service_uuid) {
    log('mongodb', `exists uuid=${state.mongodb_service_uuid}`);
    if (!dryRun) {
      await upsertServiceEnvs(client, state.mongodb_service_uuid, envs);
      log('mongodb', 'envs updated');
    } else {
      log('mongodb', 'would update envs');
    }
    return state;
  }

  const body = {
    name: stack.mongodb.name,
    description: 'Namão MongoDB (rs0) for Prisma invite-requests',
    project_uuid: state.project_uuid,
    environment_name: state.environment_name,
    environment_uuid: state.environment_uuid || undefined,
    server_uuid: state.server_uuid,
    instant_deploy: true,
    docker_compose_raw: encodeComposeFile('compose/mongodb.yml'),
  };

  if (dryRun) {
    log('mongodb', `would CREATE service ${stack.mongodb.name}`);
    return state;
  }

  const created = await client.post<ServiceCreated>('/services', body);
  if (!created?.uuid) {
    throw new Error('Coolify did not return mongodb service uuid');
  }
  state.mongodb_service_uuid = created.uuid;
  log('mongodb', `created uuid=${created.uuid}`);
  await upsertServiceEnvs(client, created.uuid, envs);
  log('mongodb', 'envs set');
  return state;
}
