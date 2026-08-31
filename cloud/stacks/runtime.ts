import type { CoolifyClient } from '../lib/coolify-client.js';
import type { StackConfig } from '../lib/config.js';
import { log } from '../lib/config.js';
import type { CloudState } from '../lib/state.js';
import { mongoConnectionUrl } from './mongodb.js';

type AppCreated = { uuid?: string };
type AppEnv = { uuid?: string; key?: string; value?: string };

async function upsertAppEnvs(
  client: CoolifyClient,
  appUuid: string,
  envs: Record<string, string>,
): Promise<void> {
  const existing = await client.get<AppEnv[]>(`/applications/${appUuid}/envs`);
  const byKey = new Map(
    (Array.isArray(existing) ? existing : [])
      .filter((e) => e.key)
      .map((e) => [e.key as string, e]),
  );

  const missing: Array<{ key: string; value: string; is_literal: boolean }> =
    [];
  for (const [key, value] of Object.entries(envs)) {
    const found = byKey.get(key);
    if (found?.uuid) {
      await client.patch(`/applications/${appUuid}/envs`, {
        uuid: found.uuid,
        key,
        value,
        is_literal: true,
      });
    } else {
      missing.push({ key, value, is_literal: true });
    }
  }
  if (missing.length) {
    await client.post(`/applications/${appUuid}/envs/bulk`, {
      data: missing,
    });
  }
}

export function buildRuntimeEnvs(opts: {
  state: CloudState;
  stack: StackConfig;
}): Record<string, string> {
  const user = process.env.MONGO_ROOT_USERNAME?.trim() || 'root';
  const mongoUrl = mongoConnectionUrl({
    user,
    password: opts.state.mongo_password,
    database: opts.stack.mongodb.database,
  });

  const envs: Record<string, string> = {
    PORT: '3001',
    NODE_ENV: 'production',
    MONGODB_URL: mongoUrl,
    JWT_SECRET:
      process.env.JWT_SECRET?.trim() || 'dev-jwt-secret-change-me',
  };

  const gemini = process.env.GEMINI_API_KEY?.trim();
  if (gemini) envs.GEMINI_API_KEY = gemini;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    envs.DATABASE_URL = databaseUrl;
  } else {
    // Placeholder — runtime needs the shared platform Prisma DB.
    envs.DATABASE_URL = 'file:./dev.db';
  }

  const redis = process.env.REDIS_URL?.trim();
  if (redis) envs.REDIS_URL = redis;

  const namao =
    process.env.NAMAO_PUBLIC_URL?.trim() || opts.stack.runtime.domain;
  if (namao) envs.NAMAO_PUBLIC_URL = namao.replace(/\/$/, '');

  return envs;
}

export async function applyRuntime(opts: {
  client: CoolifyClient;
  stack: StackConfig;
  state: CloudState;
  dryRun: boolean;
}): Promise<CloudState> {
  const { client, stack, dryRun } = opts;
  const state = { ...opts.state };
  const envs = buildRuntimeEnvs({ state, stack });

  if (!process.env.DATABASE_URL?.trim()) {
    log(
      'runtime',
      'WARN: DATABASE_URL unset — runtime needs the shared platform Prisma DB. Using placeholder file:./dev.db',
    );
  }

  if (state.runtime_application_uuid) {
    log('runtime', `exists uuid=${state.runtime_application_uuid}`);
    if (!dryRun) {
      await upsertAppEnvs(client, state.runtime_application_uuid, envs);
      const patch: Record<string, unknown> = {
        docker_registry_image_name: stack.runtime.image_name,
        docker_registry_image_tag: stack.runtime.image_tag,
        ports_exposes: stack.runtime.ports_exposes,
        health_check_enabled: true,
        health_check_path: stack.runtime.health_check_path,
        health_check_port: '3001',
      };
      if (stack.runtime.domain.trim()) {
        patch.domains = stack.runtime.domain.trim();
      }
      await client.patch(
        `/applications/${state.runtime_application_uuid}`,
        patch,
      );
      log('runtime', 'envs + image settings updated');
    } else {
      log('runtime', 'would update envs + image settings');
    }
    return state;
  }

  const body: Record<string, unknown> = {
    name: stack.runtime.name,
    description: 'Namão runtime — public chat API (@namao/runtime)',
    project_uuid: state.project_uuid,
    server_uuid: state.server_uuid,
    environment_name: state.environment_name,
    environment_uuid: state.environment_uuid || undefined,
    docker_registry_image_name: stack.runtime.image_name,
    docker_registry_image_tag: stack.runtime.image_tag,
    ports_exposes: stack.runtime.ports_exposes,
    health_check_enabled: true,
    health_check_path: stack.runtime.health_check_path,
    health_check_port: '3001',
    health_check_method: 'GET',
    health_check_return_code: 200,
    instant_deploy: true,
  };
  if (stack.runtime.domain.trim()) {
    body.domains = stack.runtime.domain.trim();
  }

  if (dryRun) {
    log(
      'runtime',
      `would CREATE application ${stack.runtime.name} from ${stack.runtime.image_name}:${stack.runtime.image_tag}`,
    );
    return state;
  }

  const created = await client.post<AppCreated>(
    '/applications/dockerimage',
    body,
  );
  if (!created?.uuid) {
    throw new Error('Coolify did not return runtime application uuid');
  }
  state.runtime_application_uuid = created.uuid;
  log('runtime', `created uuid=${created.uuid}`);
  await upsertAppEnvs(client, created.uuid, envs);
  log('runtime', 'envs set');
  return state;
}
