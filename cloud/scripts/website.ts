import { createCloudflareClientFromEnv } from '../lib/cloudflare-client.js';
import { loadEnv, loadStackConfig, log } from '../lib/config.js';
import { loadState, saveState } from '../lib/state.js';
import {
  resolveWebsiteProxyOrigins,
  writeWebsiteRedirects,
} from '../lib/website-redirects.js';
import { applyWebsitePages } from '../stacks/website-pages.js';

async function main() {
  loadEnv();
  const dryRun = process.argv.includes('--plan');
  const stack = loadStackConfig();
  const client = createCloudflareClientFromEnv();
  let state = loadState();

  log('website', dryRun ? 'dry-run (plan)' : 'applying Cloudflare Pages');
  log('website', `project=${stack.website.pages_project}`);

  state = await applyWebsitePages({ client, stack, state, dryRun });

  const origins = resolveWebsiteProxyOrigins();
  if (dryRun) {
    if (origins.apiOrigin) {
      log('website', 'would write apps/website/public/_redirects (API proxy)');
    } else {
      log('website', 'no API proxy (set WEBSITE_API_ORIGIN)');
    }
  } else {
    const redirects = writeWebsiteRedirects(origins);
    if (redirects.written) {
      log('website', `redirects → ${redirects.path}`);
    } else {
      log('website', 'no API proxy (set WEBSITE_API_ORIGIN)');
    }
    saveState(state);
    log('website', 'state.json written');
  }

  const host = state.cloudflare_pages_subdomain || `${stack.website.pages_project}.pages.dev`;
  console.log('\n--- Cloudflare Pages ---');
  console.log(`Project:  ${stack.website.pages_project}`);
  console.log(`Preview:  https://${host}`);
  console.log('Deploy:   GitHub Action cd-website.yml on push to main');
  if (stack.website.domain) {
    console.log(`Custom:   ${stack.website.domain}`);
    console.log(
      `DNS:      CNAME ${stack.website.domain.replace(/^https?:\/\//, '')} → ${host}`,
    );
  }
  console.log('');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
