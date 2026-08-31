import type { CoolifyClient } from '../lib/coolify-client.js';
import { encodeComposeFile } from '../lib/encode.js';
import type { StackConfig } from '../lib/config.js';
import { log } from '../lib/config.js';
import type { CloudState } from '../lib/state.js';

type ServiceCreated = { uuid?: string; domains?: string[] };
type ServiceEnv = { uuid?: string; key?: string; value?: string };

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

export function evolutionConnectionUri(opts: {
  user: string;
  password: string;
  database: string;
}): string {
  const user = encodeURIComponent(opts.user);
  const pass = encodeURIComponent(opts.password);
  return `postgresql://${user}:${pass}@evolution-postgres:5432/${opts.database}?schema=public`;
}

export async function applyEvolution(opts: {
  client: CoolifyClient;
  stack: StackConfig;
  state: CloudState;
  dryRun: boolean;
}): Promise<CloudState> {
  const { client, stack, dryRun } = opts;
  const state = { ...opts.state };

  const pgUser = process.env.EVOLUTION_POSTGRES_USER?.trim() || 'evolution';
  const pgPass = state.evolution_postgres_password;
  const pgDb = process.env.EVOLUTION_POSTGRES_DB?.trim() || 'evolution';
  const apiKey = state.evolution_api_key;
  const serverUrl =
    process.env.EVOLUTION_SERVER_URL?.trim() ||
    stack.evolution.domain ||
    'http://evolution-api:8080';

  const envs = {
    SERVER_URL: serverUrl,
    AUTHENTICATION_API_KEY: apiKey,
    POSTGRES_USER: pgUser,
    POSTGRES_PASSWORD: pgPass,
    POSTGRES_DB: pgDb,
    DATABASE_CONNECTION_URI: evolutionConnectionUri({
      user: pgUser,
      password: pgPass,
      database: pgDb,
    }),
  };

  const urls =
    stack.evolution.domain.trim() !== ''
      ? [{ name: 'evolution-api', url: stack.evolution.domain.trim() }]
      : undefined;

  if (state.evolution_service_uuid) {
    log('evolution', `exists uuid=${state.evolution_service_uuid}`);
    if (!dryRun) {
      await upsertServiceEnvs(client, state.evolution_service_uuid, envs);
      if (urls) {
        await client.patch(`/services/${state.evolution_service_uuid}`, {
          urls,
        });
      }
      log('evolution', 'envs updated');
    } else {
      log('evolution', 'would update envs' + (urls ? ' + urls' : ''));
    }
    return state;
  }

  const body: Record<string, unknown> = {
    name: stack.evolution.name,
    description: 'Namão Evolution API (WhatsApp) + Postgres + Redis',
    project_uuid: state.project_uuid,
    environment_name: state.environment_name,
    environment_uuid: state.environment_uuid || undefined,
    server_uuid: state.server_uuid,
    instant_deploy: true,
    docker_compose_raw: encodeComposeFile('compose/evolution.yml'),
  };
  if (urls) body.urls = urls;

  if (dryRun) {
    log('evolution', `would CREATE service ${stack.evolution.name}`);
    return state;
  }

  const created = await client.post<ServiceCreated>('/services', body);
  if (!created?.uuid) {
    throw new Error('Coolify did not return evolution service uuid');
  }
  state.evolution_service_uuid = created.uuid;
  log('evolution', `created uuid=${created.uuid}`);
  await upsertServiceEnvs(client, created.uuid, envs);
  log('evolution', 'envs set');
  return state;
}
