import {
  CloudflareClient,
  CloudflareError,
} from '../lib/cloudflare-client.js';
import type { StackConfig } from '../lib/config.js';
import { log } from '../lib/config.js';
import type { CloudState } from '../lib/state.js';

type PagesProject = {
  id?: string;
  name?: string;
  subdomain?: string;
  production_branch?: string;
};

type PagesDomain = {
  id?: string;
  name?: string;
  status?: string;
};

function extraHostnames(apex: string): string[] {
  const host = apex.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  if (!host) return [];
  if (host.startsWith('www.')) return [host, host.slice(4)];
  return [host, `www.${host}`];
}

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
      return state;
    }
    existing = await client.post<PagesProject>(
      client.accountPath('/pages/projects'),
      { name, production_branch: branch },
    );
    log(
      'website',
      `created ${name} → https://${existing.subdomain || `${name}.pages.dev`}`,
    );
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
    existing.subdomain || `${name}.pages.dev`;

  const hosts = extraHostnames(stack.website.domain);
  if (!hosts.length) {
    log('website', 'no custom domain (set WEBSITE_DOMAIN when DNS is ready)');
    return state;
  }

  if (dryRun) {
    log('website', `would ensure domains: ${hosts.join(', ')}`);
    return state;
  }

  const listed = await client.get<PagesDomain[]>(`${projectPath}/domains`);
  const have = new Set(
    (Array.isArray(listed) ? listed : []).map((d) => d.name).filter(Boolean),
  );

  for (const host of hosts) {
    if (have.has(host)) {
      log('website', `domain ${host} already attached`);
      continue;
    }
    try {
      await client.post(`${projectPath}/domains`, { name: host });
      log('website', `domain ${host} attached — point DNS to ${state.cloudflare_pages_subdomain}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log('website', `WARN: could not attach ${host}: ${msg}`);
    }
  }

  return state;
}
