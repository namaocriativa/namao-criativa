import { createCloudflareClientFromEnv } from '../lib/cloudflare-client.js';
import { loadEnv, loadStackConfig, log } from '../lib/config.js';
import { loadState, saveState } from '../lib/state.js';
import { applyStudioPages } from '../stacks/studio-pages.js';

async function main() {
  loadEnv();
  const dryRun = process.argv.includes('--plan');
  const stack = loadStackConfig();
  const client = createCloudflareClientFromEnv();
  let state = loadState();

  log('studio', dryRun ? 'dry-run (plan)' : 'applying Cloudflare Pages');
  log('studio', `project=${stack.studio.pages_project}`);

  state = await applyStudioPages({ client, stack, state, dryRun });

  if (!dryRun) {
    saveState(state);
    log('studio', 'state.json written');
  }

  const host =
    state.cloudflare_studio_pages_subdomain ||
    `${stack.studio.pages_project}.pages.dev`;
  console.log('\n--- Cloudflare Pages (studio) ---');
  console.log(`Project:  ${stack.studio.pages_project}`);
  console.log(`Preview:  https://${host}`);
  console.log('Deploy:   GitHub Action cd-studio.yml on push to main');
  if (stack.studio.domain) {
    console.log(`Custom:   ${stack.studio.domain}`);
    console.log(
      `DNS:      CNAME ${stack.studio.domain.replace(/^https?:\/\//, '')} → ${host}`,
    );
  }
  console.log('Env:      JWT_SECRET + STUDIO_API_ORIGIN on the Pages project');
  console.log('');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
