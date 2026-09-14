import { createClientFromEnv } from '../lib/coolify-client.js';
import { loadEnv, log } from '../lib/config.js';
import { loadState } from '../lib/state.js';

type DeployResponse = {
  deployments?: Array<{
    message?: string;
    resource_uuid?: string;
    deployment_uuid?: string;
  }>;
};

async function deployUuid(
  label: string,
  uuid: string,
  force: boolean,
): Promise<void> {
  if (!uuid) {
    log('deploy', `skip ${label} (no uuid in state)`);
    return;
  }
  const client = createClientFromEnv();
  log('deploy', `${label} uuid=${uuid}${force ? ' force=true' : ''}`);
  const res = await client.get<DeployResponse>('/deploy', {
    uuid,
    force: force ? true : undefined,
  });
  const items = res?.deployments || [];
  if (!items.length) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }
  for (const d of items) {
    log(
      'deploy',
      `${d.message || 'queued'} resource=${d.resource_uuid} deployment=${d.deployment_uuid}`,
    );
  }
}

async function main() {
  loadEnv();
  const state = loadState();
  const force = process.argv.includes('--force');

  if (
    !state.postgres_database_uuid &&
    !state.redis_database_uuid &&
    !state.evolution_application_uuid &&
    !state.runtime_application_uuid
  ) {
    throw new Error('Nothing to deploy. Run apply first.');
  }

  await deployUuid('postgres', state.postgres_database_uuid, force);
  await deployUuid('redis', state.redis_database_uuid, force);
  await deployUuid('evolution', state.evolution_application_uuid, force);
  await deployUuid('runtime', state.runtime_application_uuid, force);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
