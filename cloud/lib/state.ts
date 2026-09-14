import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cloudRoot } from './encode.js';

export type CloudState = {
  server_uuid: string;
  project_uuid: string;
  environment_uuid: string;
  environment_name: string;
  /** @deprecated MongoDB is Atlas — kept for old state.json cleanup */
  mongodb_service_uuid?: string;
  destination_uuid?: string;
  postgres_database_uuid: string;
  postgres_user: string;
  postgres_db: string;
  postgres_password: string;
  redis_database_uuid: string;
  redis_password: string;
  /** @deprecated compose service — deleted after Evolution becomes an Application */
  evolution_service_uuid: string;
  evolution_application_uuid: string;
  runtime_application_uuid: string;
  /** @deprecated Evolution now uses namao-postgres ?schema=evolution_api */
  evolution_postgres_password: string;
  evolution_api_key: string;
  cloudflare_pages_project?: string;
  cloudflare_pages_subdomain?: string;
  cloudflare_studio_pages_project?: string;
  cloudflare_studio_pages_subdomain?: string;
  updated_at: string;
};

const STATE_PATH = join(cloudRoot(), 'state.json');

export function emptyState(): CloudState {
  return {
    server_uuid: '',
    project_uuid: '',
    environment_uuid: '',
    environment_name: 'production',
    postgres_database_uuid: '',
    postgres_user: '',
    postgres_db: '',
    postgres_password: '',
    redis_database_uuid: '',
    redis_password: '',
    evolution_service_uuid: '',
    evolution_application_uuid: '',
    runtime_application_uuid: '',
    evolution_postgres_password: '',
    evolution_api_key: '',
    updated_at: '',
  };
}

export function loadState(): CloudState {
  if (!existsSync(STATE_PATH)) return emptyState();
  const raw = JSON.parse(readFileSync(STATE_PATH, 'utf8')) as Partial<CloudState>;
  const merged = { ...emptyState(), ...raw };
  // Drop legacy Coolify Mongo fields from in-memory state
  delete merged.mongodb_service_uuid;
  return merged;
}

export function saveState(state: CloudState): void {
  const toSave = { ...state };
  delete toSave.mongodb_service_uuid;
  toSave.updated_at = new Date().toISOString();
  writeFileSync(STATE_PATH, `${JSON.stringify(toSave, null, 2)}\n`, 'utf8');
}

export function statePath(): string {
  return STATE_PATH;
}
