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
  evolution: {
    name: string;
    instance: string;
    domain: string;
  };
  website: {
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

export function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is required (PostgreSQL). Put it in the repo root .env or cloud/.env',
    );
  }
  if (url.startsWith('file:')) {
    throw new Error(
      'DATABASE_URL must be PostgreSQL in cloud (file: SQLite is not reachable from Coolify).',
    );
  }
  return url;
}

export function loadStackConfig(): StackConfig {
  const examplePath = join(cloudRoot(), 'config', 'stack.example.json');
  const localPath = join(cloudRoot(), 'config', 'stack.json');
  const path = existsSync(localPath) ? localPath : examplePath;
  const file = JSON.parse(readFileSync(path, 'utf8')) as Partial<StackConfig> & {
    mongodb?: unknown;
    website?: Partial<StackConfig['website']>;
    runtime?: Partial<StackConfig['runtime']>;
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
        process.env.WEBSITE_DOMAIN?.trim() || file.website?.domain || '',
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
