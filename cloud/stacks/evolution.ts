import { CoolifyError, type CoolifyClient } from '../lib/coolify-client.js';
import { upsertAppEnvs } from '../lib/app-envs.js';
import type { StackConfig } from '../lib/config.js';
import { log } from '../lib/config.js';
import {
  applicationExists,
  findApplicationByName,
} from '../lib/coolify-database.js';
import type { CloudState } from '../lib/state.js';
import { resolveEvolutionDatabaseUrl } from './postgres.js';
import { resolveRedisUrl } from './redis.js';

type AppCreated = { uuid?: string; fqdn?: string };
type AppDetail = { uuid?: string; fqdn?: string };
type Storages = {
  persistent_storages?: Array<{ uuid?: string; mount_path?: string }>;
};

const INSTANCES_MOUNT = '/evolution/instances';

async function ensureInstancesVolume(
  client: CoolifyClient,
  appUuid: string,
): Promise<void> {
  const storages = await client.get<Storages>(
    `/applications/${appUuid}/storages`,
  );
  const mounts = storages?.persistent_storages || [];
  if (mounts.some((s) => s.mount_path === INSTANCES_MOUNT)) return;
  await client.post(`/applications/${appUuid}/storages`, {
    type: 'persistent',
    name: 'evolution-instances',
    mount_path: INSTANCES_MOUNT,
  });
  log('evolution', `volume ${INSTANCES_MOUNT} attached`);
}

async function readFqdn(
  client: CoolifyClient,
  appUuid: string,
): Promise<string> {
  const app = await client.get<AppDetail>(`/applications/${appUuid}`);
  return (app?.fqdn || '').replace(/\/$/, '');
}

function resolveServerUrl(stack: StackConfig, fqdn: string): string {
  const configured =
    process.env.EVOLUTION_SERVER_URL?.trim() ||
    stack.evolution.domain.trim() ||
    fqdn;
  return configured.replace(/\/$/, '');
}

export function buildEvolutionEnvs(opts: {
  stack: StackConfig;
  state: CloudState;
  serverUrl: string;
}): Record<string, string> {
  const databaseUrl = resolveEvolutionDatabaseUrl(opts.state, opts.stack);
  const redisUrl = resolveRedisUrl(opts.state, 1);
  return {
    SERVER_URL: opts.serverUrl,
    SERVER_PORT: '8080',
    AUTHENTICATION_API_KEY: opts.state.evolution_api_key,
    AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES: 'true',
    DATABASE_PROVIDER: 'postgresql',
    DATABASE_CONNECTION_URI: databaseUrl,
    DATABASE_CONNECTION_CLIENT_NAME: 'evolution_namao',
    DATABASE_SAVE_DATA_INSTANCE: 'true',
    DATABASE_SAVE_DATA_NEW_MESSAGE: 'true',
    DATABASE_SAVE_MESSAGE_UPDATE: 'true',
    DATABASE_SAVE_DATA_CONTACTS: 'true',
    DATABASE_SAVE_DATA_CHATS: 'true',
    CACHE_REDIS_ENABLED: 'true',
    CACHE_REDIS_URI: redisUrl,
    CACHE_REDIS_PREFIX_KEY: 'evolution',
    CACHE_LOCAL_ENABLED: 'false',
    RABBITMQ_ENABLED: 'false',
    SQS_ENABLED: 'false',
    WEBHOOK_GLOBAL_ENABLED: 'false',
  };
}

async function removeLegacyComposeService(
  client: CoolifyClient,
  state: CloudState,
  dryRun: boolean,
): Promise<void> {
  if (!state.evolution_service_uuid) return;
  if (dryRun) {
    log(
      'evolution',
      `would DELETE compose service uuid=${state.evolution_service_uuid}`,
    );
    return;
  }
  try {
    await client.delete(`/services/${state.evolution_service_uuid}`);
    log('evolution', `deleted compose service uuid=${state.evolution_service_uuid}`);
  } catch (err) {
    if (err instanceof CoolifyError && err.status === 404) {
      log('evolution', 'compose service already gone');
    } else {
      throw err;
    }
  }
  state.evolution_service_uuid = '';
}

export async function applyEvolution(opts: {
  client: CoolifyClient;
  stack: StackConfig;
  state: CloudState;
  dryRun: boolean;
}): Promise<CloudState> {
  const { client, stack, dryRun } = opts;
  const state = { ...opts.state };

  await removeLegacyComposeService(client, state, dryRun);

  if (state.evolution_application_uuid) {
    const exists = await applicationExists(
      client,
      state.evolution_application_uuid,
    );
    if (!exists) {
      log(
        'evolution',
        `uuid=${state.evolution_application_uuid} missing — will recreate`,
      );
      state.evolution_application_uuid = '';
    }
  }

  if (!state.evolution_application_uuid) {
    const existing = await findApplicationByName(client, stack.evolution.name);
    if (existing) {
      state.evolution_application_uuid = existing;
      log('evolution', `adopted existing uuid=${existing}`);
    }
  }

  const image = `${stack.evolution.image_name}:${stack.evolution.image_tag}`;

  if (state.evolution_application_uuid) {
    log('evolution', `exists uuid=${state.evolution_application_uuid}`);
    if (!dryRun) {
      const fqdn = await readFqdn(client, state.evolution_application_uuid);
      const serverUrl = resolveServerUrl(stack, fqdn);
      await upsertAppEnvs(
        client,
        state.evolution_application_uuid,
        buildEvolutionEnvs({ stack, state, serverUrl }),
      );
      const patch: Record<string, unknown> = {
        docker_registry_image_name: stack.evolution.image_name,
        docker_registry_image_tag: stack.evolution.image_tag,
        ports_exposes: stack.evolution.ports_exposes,
        health_check_enabled: true,
        health_check_path: stack.evolution.health_check_path,
        health_check_port: '8080',
      };
      if (stack.evolution.domain.trim()) {
        patch.domains = stack.evolution.domain.trim();
      }
      await client.patch(
        `/applications/${state.evolution_application_uuid}`,
        patch,
      );
      await ensureInstancesVolume(client, state.evolution_application_uuid);
      log('evolution', 'envs + image settings updated');
    } else {
      log('evolution', 'would update envs + image settings');
    }
    return state;
  }

  const body: Record<string, unknown> = {
    name: stack.evolution.name,
    description: 'Namão Evolution API (WhatsApp)',
    project_uuid: state.project_uuid,
    server_uuid: state.server_uuid,
    environment_name: state.environment_name,
    environment_uuid: state.environment_uuid || undefined,
    docker_registry_image_name: stack.evolution.image_name,
    docker_registry_image_tag: stack.evolution.image_tag,
    ports_exposes: stack.evolution.ports_exposes,
    health_check_enabled: true,
    health_check_path: stack.evolution.health_check_path,
    health_check_port: '8080',
    health_check_method: 'GET',
    health_check_return_code: 200,
    instant_deploy: true,
  };
  if (state.destination_uuid) {
    body.destination_uuid = state.destination_uuid;
  }
  if (stack.evolution.domain.trim()) {
    body.domains = stack.evolution.domain.trim();
  }

  if (dryRun) {
    log('evolution', `would CREATE application ${stack.evolution.name} from ${image}`);
    return state;
  }

  const created = await client.post<AppCreated>(
    '/applications/dockerimage',
    body,
  );
  if (!created?.uuid) {
    throw new Error('Coolify did not return evolution application uuid');
  }
  state.evolution_application_uuid = created.uuid;
  log('evolution', `created uuid=${created.uuid}`);

  const fqdn = created.fqdn?.replace(/\/$/, '') || (await readFqdn(client, created.uuid));
  const serverUrl = resolveServerUrl(stack, fqdn);
  await upsertAppEnvs(
    client,
    created.uuid,
    buildEvolutionEnvs({ stack, state, serverUrl }),
  );
  await ensureInstancesVolume(client, created.uuid);
  log('evolution', 'envs + volume set');
  return state;
}
