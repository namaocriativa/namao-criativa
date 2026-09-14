import {
  CloudflareClient,
  CloudflareError,
} from '../lib/cloudflare-client.js';
import type { StackConfig } from '../lib/config.js';
import { log } from '../lib/config.js';
import {
  attachPagesDomains,
  extraHostnames,
} from '../lib/pages-custom-domains.js';
import type { CloudState } from '../lib/state.js';

type PagesProject = {
  id?: string;
  name?: string;
  subdomain?: string;
  production_branch?: string;
};

export async function applyWebsitePages(opts: {
  client: CloudflareClient;
  stack: StackConfig;
  state: CloudState;
  dryRun: boolean;
}): Promise<CloudState> {
  const { client, stack, dryRun } = opts;
  const state = { ...opts.state };
  const name = stack.website.pages_project;
  const branch = stack.website.production_branch;
  const projectPath = client.accountPath(`/pages/projects/${name}`);

  let existing: PagesProject | null = null;
  try {
    existing = await client.get<PagesProject>(projectPath);
  } catch (err) {
    const notFound =
      err instanceof CloudflareError &&
      (err.status === 404 || /not found/i.test(err.message));
    if (!notFound) throw err;
  }

  if (!existing) {
    if (dryRun) {
      log('website', `would CREATE Pages project ${name} (branch ${branch})`);
    } else {
      existing = await client.post<PagesProject>(
        client.accountPath('/pages/projects'),
        { name, production_branch: branch },
      );
      log(
        'website',
        `created ${name} → https://${existing.subdomain || `${name}.pages.dev`}`,
      );
    }
  } else {
    log(
      'website',
      `exists ${name} → https://${existing.subdomain || `${name}.pages.dev`}`,
    );
    if (existing.production_branch !== branch) {
      if (dryRun) {
        log('website', `would set production_branch=${branch}`);
      } else {
        existing = await client.patch<PagesProject>(projectPath, {
          production_branch: branch,
        });
        log('website', `production_branch=${branch}`);
      }
    }
  }

  state.cloudflare_pages_project = name;
  state.cloudflare_pages_subdomain =
    existing?.subdomain || `${name}.pages.dev`;

  await attachPagesDomains({
    client,
    projectPath,
    hostnames: extraHostnames(stack.website.domain, { includeWww: true }),
    pagesDev: state.cloudflare_pages_subdomain,
    step: 'website',
    dryRun,
  });

  return state;
}
