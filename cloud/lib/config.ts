import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { cloudRoot } from './encode.js';

export type StackConfig = {
  project_name: string;
  environment_name: string;
  server_name: string;
  runtime: {
    name: string;
    image_name: string;
    image_tag: string;
    ports_exposes: string;
    health_check_path: string;
    domain: string;
  };
  postgres: {
    name: string;
    user: string;
    database: string;
    image: string;
  };
  redis: {
    name: string;
    image: string;
  };
  evolution: {
    name: string;
    instance: string;
    domain: string;
    image_name: string;
    image_tag: string;
    ports_exposes: string;
    health_check_path: string;
  };
  website: {
    pages_project: string;
    production_branch: string;
    domain: string;
  };
  studio: {
    pages_project: string;
    production_branch: string;
    domain: string;
  };
};

export function loadEnv(): void {
  // Root monorepo .env first (shared secrets), then cloud/.env overrides
  const rootEnv = join(cloudRoot(), '..', '.env');
  if (existsSync(rootEnv)) {
    loadDotenv({ path: rootEnv });
  }
  loadDotenv({ path: join(cloudRoot(), '.env'), override: true });
}

export function loadStackConfig(): StackConfig {
  const examplePath = join(cloudRoot(), 'config', 'stack.example.json');
  const localPath = join(cloudRoot(), 'config', 'stack.json');
  const path = existsSync(localPath) ? localPath : examplePath;
  const file = JSON.parse(readFileSync(path, 'utf8')) as Partial<StackConfig> & {
    mongodb?: unknown;
    website?: Partial<StackConfig['website']>;
    studio?: Partial<StackConfig['studio']>;
    runtime?: Partial<StackConfig['runtime']>;
    postgres?: Partial<StackConfig['postgres']>;
    redis?: Partial<StackConfig['redis']>;
    evolution?: Partial<StackConfig['evolution']>;
  };

  return {
    project_name:
      process.env.COOLIFY_PROJECT_NAME?.trim() || file.project_name || 'namao',
    environment_name:
      process.env.COOLIFY_ENVIRONMENT_NAME?.trim() ||
      file.environment_name ||
      'production',
    server_name:
      process.env.COOLIFY_SERVER_NAME?.trim() || file.server_name || 'localhost',
    postgres: {
      name: file.postgres?.name || 'namao-postgres',
      user:
        process.env.POSTGRES_USER?.trim() || file.postgres?.user || 'namao',
      database:
        process.env.POSTGRES_DB?.trim() || file.postgres?.database || 'namao',
      image: file.postgres?.image || 'postgres:16-alpine',
    },
    redis: {
      name: file.redis?.name || 'namao-redis',
      image: file.redis?.image || 'redis:7-alpine',
    },
    runtime: {
      name: file.runtime?.name || 'namao-api',
      image_name:
        process.env.RUNTIME_IMAGE_NAME?.trim() ||
        file.runtime?.image_name ||
        'ghcr.io/namaocriativa/namao-api',
      image_tag:
        process.env.RUNTIME_IMAGE_TAG?.trim() ||
        file.runtime?.image_tag ||
        'latest',
      ports_exposes: file.runtime?.ports_exposes || '3000',
      health_check_path: file.runtime?.health_check_path || '/health',
      domain:
        process.env.RUNTIME_DOMAIN?.trim() || file.runtime?.domain || '',
    },
    evolution: {
      name: file.evolution?.name || 'namao-evolution',
      instance:
        process.env.EVOLUTION_INSTANCE?.trim() ||
        file.evolution?.instance ||
        'namao',
      domain:
        process.env.EVOLUTION_DOMAIN?.trim() || file.evolution?.domain || '',
      image_name:
        process.env.EVOLUTION_IMAGE_NAME?.trim() ||
        file.evolution?.image_name ||
        'evoapicloud/evolution-api',
      image_tag:
        process.env.EVOLUTION_IMAGE_TAG?.trim() ||
        file.evolution?.image_tag ||
        'v2.3.7',
      ports_exposes: file.evolution?.ports_exposes || '8080',
      health_check_path: file.evolution?.health_check_path || '/',
    },
    website: {
      pages_project:
        process.env.CLOUDFLARE_PAGES_PROJECT?.trim() ||
        file.website?.pages_project ||
        'namao-website',
      production_branch:
        process.env.WEBSITE_PRODUCTION_BRANCH?.trim() ||
        file.website?.production_branch ||
        'main',
      domain:
        process.env.WEBSITE_DOMAIN?.trim() ||
        file.website?.domain ||
        'namaocriativa.com.br',
    },
    studio: {
      pages_project:
        process.env.CLOUDFLARE_STUDIO_PAGES_PROJECT?.trim() ||
        file.studio?.pages_project ||
        'namao-studio',
      production_branch:
        process.env.STUDIO_PRODUCTION_BRANCH?.trim() ||
        file.studio?.production_branch ||
        'main',
      domain:
        process.env.STUDIO_DOMAIN?.trim() ||
        file.studio?.domain ||
        'studio.namaocriativa.com.br',
    },
  };
}

export function randomSecret(bytes = 24): string {
  return randomBytes(bytes).toString('hex');
}

export function requireSecret(
  envKey: string,
  fallbackFromState: string,
  generate = true,
): string {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  if (fallbackFromState) return fallbackFromState;
  if (generate) return randomSecret();
  throw new Error(`${envKey} is required`);
}

export function log(step: string, message: string): void {
  console.log(`[${step}] ${message}`);
}
