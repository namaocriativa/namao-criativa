import type { CoolifyClient } from '../lib/coolify-client.js';
import { upsertAppEnvs } from '../lib/app-envs.js';
import type { StackConfig } from '../lib/config.js';
import { log } from '../lib/config.js';
import {
  ensurePersistentVolume,
  hasPersistentMount,
  RUNTIME_STORAGE_MOUNT,
  RUNTIME_STORAGE_NAME,
} from '../lib/coolify-storage.js';
import type { CloudState } from '../lib/state.js';
import { requireJwtSecret } from '../lib/jwt-secret.js';

type AppCreated = { uuid?: string };

function runtimeHealthCheck(stack: StackConfig): Record<string, unknown> {
  return {
    health_check_enabled: true,
    health_check_path: stack.runtime.health_check_path,
    health_check_port: '3000',
    health_check_host: 'localhost',
    health_check_scheme: 'http',
    health_check_method: 'GET',
    health_check_return_code: 200,
    // prisma migrate deploy runs before listen
    health_check_start_period: 90,
    health_check_interval: 10,
    health_check_retries: 15,
    health_check_timeout: 5,
  };
}

export function buildRuntimeEnvs(opts: {
  state: CloudState;
  stack: StackConfig;
  databaseUrl: string;
  redisUrl?: string;
}): Record<string, string> {
  const envs: Record<string, string> = {
    PORT: '3000',
    NODE_ENV: 'production',
    DATABASE_URL: opts.databaseUrl,
    STORAGE_ROOT: '/app/services/platform/storage',
    JWT_SECRET: requireJwtSecret(process.env.JWT_SECRET, 'production'),
  };

  const gemini = process.env.GEMINI_API_KEY?.trim();
  if (gemini) envs.GEMINI_API_KEY = gemini;

  if (opts.redisUrl) envs.REDIS_URL = opts.redisUrl;

  const ga4Property = process.env.GA4_PROPERTY_ID?.trim();
  if (ga4Property) envs.GA4_PROPERTY_ID = ga4Property;
  const ga4Json = process.env.GA4_SERVICE_ACCOUNT_JSON?.trim();
  if (ga4Json) envs.GA4_SERVICE_ACCOUNT_JSON = ga4Json;

  const namao =
    process.env.NAMAO_PUBLIC_URL?.trim() || opts.stack.runtime.domain;
  if (namao) envs.NAMAO_PUBLIC_URL = namao.replace(/\/$/, '');

  const studioUrl = process.env.NAMAO_STUDIO_URL?.trim();
  if (studioUrl) envs.NAMAO_STUDIO_URL = studioUrl.replace(/\/$/, '');

  const studioEmail = process.env.STUDIO_ADMIN_EMAIL?.trim();
  if (studioEmail) envs.STUDIO_ADMIN_EMAIL = studioEmail;
  const studioPassword = process.env.STUDIO_ADMIN_PASSWORD?.trim();
  if (studioPassword) envs.STUDIO_ADMIN_PASSWORD = studioPassword;

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) envs.RESEND_API_KEY = resendKey;
  const resendFrom = process.env.RESEND_FROM?.trim();
  if (resendFrom) envs.RESEND_FROM = resendFrom;

  const githubWebsites = process.env.GITHUB_WEBSITES_TOKEN?.trim();
  if (githubWebsites) envs.GITHUB_WEBSITES_TOKEN = githubWebsites;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (cfToken) envs.CLOUDFLARE_API_TOKEN = cfToken;
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (cfAccount) envs.CLOUDFLARE_ACCOUNT_ID = cfAccount;

  const pixKey = process.env.NAMAO_PIX_KEY?.trim();
  if (pixKey) envs.NAMAO_PIX_KEY = pixKey;
  const cnpj = process.env.NAMAO_CNPJ?.trim();
  if (cnpj) envs.NAMAO_CNPJ = cnpj;
  const legalName = process.env.NAMAO_LEGAL_NAME?.trim();
  if (legalName) envs.NAMAO_LEGAL_NAME = legalName;

  return envs;
}

async function ensureRuntimeStorageVolume(
  client: CoolifyClient,
  appUuid: string,
): Promise<void> {
  await ensurePersistentVolume(client, appUuid, {
    name: RUNTIME_STORAGE_NAME,
    mountPath: RUNTIME_STORAGE_MOUNT,
    step: 'runtime',
  });
}

export async function applyRuntime(opts: {
  client: CoolifyClient;
  stack: StackConfig;
  state: CloudState;
  dryRun: boolean;
  databaseUrl: string;
  redisUrl?: string;
}): Promise<CloudState> {
  const { client, stack, dryRun, databaseUrl, redisUrl } = opts;
  const state = { ...opts.state };
  const envs = buildRuntimeEnvs({ state, stack, databaseUrl, redisUrl });

  if (state.runtime_application_uuid) {
    log('runtime', `exists uuid=${state.runtime_application_uuid}`);
    if (!dryRun) {
      await upsertAppEnvs(client, state.runtime_application_uuid, envs);
      const patch: Record<string, unknown> = {
        docker_registry_image_name: stack.runtime.image_name,
        docker_registry_image_tag: stack.runtime.image_tag,
        ports_exposes: stack.runtime.ports_exposes,
        ...runtimeHealthCheck(stack),
      };
      if (stack.runtime.domain.trim()) {
        patch.domains = stack.runtime.domain.trim();
      }
      await client.patch(
        `/applications/${state.runtime_application_uuid}`,
        patch,
      );
      await ensureRuntimeStorageVolume(
        client,
        state.runtime_application_uuid,
      );
      log('runtime', 'envs + image settings updated');
    } else {
      log('runtime', 'would update envs + image settings');
      const storages = await client.get(
        `/applications/${state.runtime_application_uuid}/storages`,
      );
      if (hasPersistentMount(storages, RUNTIME_STORAGE_MOUNT)) {
        log('runtime', `volume ${RUNTIME_STORAGE_MOUNT} already attached`);
      } else {
        log('runtime', `would attach volume ${RUNTIME_STORAGE_MOUNT}`);
      }
    }
    return state;
  }

  const body: Record<string, unknown> = {
    name: stack.runtime.name,
    description: 'Namão API — platform + chat + dashboard (@namao/platform)',
    project_uuid: state.project_uuid,
    server_uuid: state.server_uuid,
    environment_name: state.environment_name,
    environment_uuid: state.environment_uuid || undefined,
    docker_registry_image_name: stack.runtime.image_name,
    docker_registry_image_tag: stack.runtime.image_tag,
    ports_exposes: stack.runtime.ports_exposes,
    ...runtimeHealthCheck(stack),
    instant_deploy: true,
  };
  if (state.destination_uuid) {
    body.destination_uuid = state.destination_uuid;
  }
  if (stack.runtime.domain.trim()) {
    body.domains = stack.runtime.domain.trim();
  }

  if (dryRun) {
    log(
      'runtime',
      `would CREATE application ${stack.runtime.name} from ${stack.runtime.image_name}:${stack.runtime.image_tag}`,
    );
    log('runtime', `would attach volume ${RUNTIME_STORAGE_MOUNT}`);
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
  await ensureRuntimeStorageVolume(client, created.uuid);
  log('runtime', 'envs + volume set');
  return state;
}
