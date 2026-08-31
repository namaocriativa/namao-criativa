import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cloudRoot } from './encode.js';

export type CloudState = {
  server_uuid: string;
  project_uuid: string;
  environment_uuid: string;
  environment_name: string;
  mongodb_service_uuid: string;
  evolution_service_uuid: string;
  runtime_application_uuid: string;
  mongo_password: string;
  evolution_postgres_password: string;
  evolution_api_key: string;
  updated_at: string;
};

const STATE_PATH = join(cloudRoot(), 'state.json');

export function emptyState(): CloudState {
  return {
    server_uuid: '',
    project_uuid: '',
    environment_uuid: '',
    environment_name: 'production',
    mongodb_service_uuid: '',
    evolution_service_uuid: '',
    runtime_application_uuid: '',
    mongo_password: '',
    evolution_postgres_password: '',
    evolution_api_key: '',
    updated_at: '',
  };
}

export function loadState(): CloudState {
  if (!existsSync(STATE_PATH)) return emptyState();
  const raw = JSON.parse(readFileSync(STATE_PATH, 'utf8')) as Partial<CloudState>;
  return { ...emptyState(), ...raw };
}

export function saveState(state: CloudState): void {
  state.updated_at = new Date().toISOString();
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function statePath(): string {
  return STATE_PATH;
}
