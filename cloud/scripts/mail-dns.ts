import { createCloudflareClientFromEnv } from '../lib/cloudflare-client.js';
import { loadEnv, loadStackConfig, log } from '../lib/config.js';
import { ensureMailDns } from '../lib/mail-dns.js';

async function main() {
  loadEnv();
  const dryRun = process.argv.includes('--plan');
  const stack = loadStackConfig();
  const apex = stack.website.domain;
  log('mail-dns', dryRun ? `dry-run ${apex}` : `apply ${apex}`);
  const client = createCloudflareClientFromEnv();
  await ensureMailDns({ client, apex, dryRun });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
