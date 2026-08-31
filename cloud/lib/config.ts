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
  mongodb: {
    name: string;
    database: string;
  };
  evolution: {
    name: string;
    instance: string;
    domain: string;
  };
};

export function loadEnv(): void {
  loadDotenv({ path: join(cloudRoot(), '.env') });
}

export function loadStackConfig(): StackConfig {
  const examplePath = join(cloudRoot(), 'config', 'stack.example.json');
  const localPath = join(cloudRoot(), 'config', 'stack.json');
  const path = existsSync(localPath) ? localPath : examplePath;
  const file = JSON.parse(readFileSync(path, 'utf8')) as StackConfig;

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
      name: file.runtime?.name || 'namao-runtime',
      image_name:
        process.env.RUNTIME_IMAGE_NAME?.trim() ||
        file.runtime?.image_name ||
        'ghcr.io/YOUR_ORG/namao-runtime',
      image_tag:
        process.env.RUNTIME_IMAGE_TAG?.trim() ||
        file.runtime?.image_tag ||
        'latest',
      ports_exposes: file.runtime?.ports_exposes || '3001',
      health_check_path: file.runtime?.health_check_path || '/health',
      domain:
        process.env.RUNTIME_DOMAIN?.trim() || file.runtime?.domain || '',
    },
    mongodb: {
      name: file.mongodb?.name || 'namao-mongodb',
      database:
        process.env.MONGO_DATABASE?.trim() ||
        file.mongodb?.database ||
        'namao',
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
