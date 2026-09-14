import { createCloudflareClientFromEnv } from '../lib/cloudflare-client.js';
import { loadEnv, loadStackConfig, log } from '../lib/config.js';
import {
  STUDIO_PAGES_REQUIRED_ENV,
  assertStudioPagesEnv,
  productionEnvKeys,
  type PagesEnvVar,
  type PagesProjectEnv,
} from '../lib/studio-pages-env.js';

type PagesProject = PagesProjectEnv & {
  latest_deployment?: { id?: string };
};

async function main() {
  loadEnv();
  const stack = loadStackConfig();
  const client = createCloudflareClientFromEnv();
  const name = stack.studio.pages_project;
  const project = await client.get<PagesProject>(
    client.accountPath(`/pages/projects/${name}`),
  );
  const keys = productionEnvKeys(project);
  assertStudioPagesEnv(keys);
  log('studio', `Pages project env ok (${STUDIO_PAGES_REQUIRED_ENV.join(', ')})`);
  const deployId = project.latest_deployment?.id;
  if (deployId) {
    const deployment = await client.get<{
      env_vars?: Record<string, PagesEnvVar | undefined>;
    }>(client.accountPath(`/pages/projects/${name}/deployments/${deployId}`));
    const deployKeys = Object.keys(deployment.env_vars || {});
    log(
      'studio',
      `latest deployment env: ${deployKeys.join(', ') || '(none)'}`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
