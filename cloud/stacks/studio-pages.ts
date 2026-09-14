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

type PagesEnvVar = { type: 'plain_text' | 'secret_text'; value: string };

function resolveStudioApiOrigin(): string {
  return (
    process.env.STUDIO_API_ORIGIN?.trim() ||
    process.env.WEBSITE_API_ORIGIN?.trim() ||
    process.env.WEBSITE_RUNTIME_ORIGIN?.trim() ||
    process.env.WEBSITE_PLATFORM_ORIGIN?.trim() ||
    ''
  ).replace(/\/$/, '');
}

async function upsertPagesEnv(
  client: CloudflareClient,
  projectPath: string,
  vars: Record<string, PagesEnvVar>,
  dryRun: boolean,
): Promise<void> {
  if (!Object.keys(vars).length) return;
  if (dryRun) {
    log('studio', `would set Pages env: ${Object.keys(vars).join(', ')}`);
    return;
  }
  await client.patch(projectPath, {
    deployment_configs: {
      production: { env_vars: vars },
      preview: { env_vars: vars },
    },
  });
  log('studio', `Pages env updated (${Object.keys(vars).join(', ')})`);
}

export async function applyStudioPages(opts: {
  client: CloudflareClient;
  stack: StackConfig;
  state: CloudState;
  dryRun: boolean;
}): Promise<CloudState> {
  const { client, stack, dryRun } = opts;
  const state = { ...opts.state };
  const name = stack.studio.pages_project;
  const branch = stack.studio.production_branch;
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
      log('studio', `would CREATE Pages project ${name} (branch ${branch})`);
    } else {
      existing = await client.post<PagesProject>(
        client.accountPath('/pages/projects'),
        { name, production_branch: branch },
      );
      log(
        'studio',
        `created ${name} → https://${existing.subdomain || `${name}.pages.dev`}`,
      );
    }
  } else {
    log(
      'studio',
      `exists ${name} → https://${existing.subdomain || `${name}.pages.dev`}`,
    );
    if (existing.production_branch !== branch) {
      if (dryRun) {
        log('studio', `would set production_branch=${branch}`);
      } else {
        existing = await client.patch<PagesProject>(projectPath, {
          production_branch: branch,
        });
        log('studio', `production_branch=${branch}`);
      }
    }
  }

  const subdomain =
    existing?.subdomain || `${name}.pages.dev`;
  state.cloudflare_studio_pages_project = name;
  state.cloudflare_studio_pages_subdomain = subdomain;

  const envVars: Record<string, PagesEnvVar> = {};
  const apiOrigin = resolveStudioApiOrigin();
  if (apiOrigin) {
    envVars.STUDIO_API_ORIGIN = { type: 'plain_text', value: apiOrigin };
  } else {
    log('studio', 'no STUDIO_API_ORIGIN / WEBSITE_API_ORIGIN (set before deploy)');
  }
  const jwt = process.env.JWT_SECRET?.trim();
  if (jwt) {
    envVars.JWT_SECRET = { type: 'secret_text', value: jwt };
  } else {
    log('studio', 'no JWT_SECRET — Pages middleware cannot validate cookies');
  }
  if (existing || !dryRun) {
    await upsertPagesEnv(client, projectPath, envVars, dryRun);
  }

  await attachPagesDomains({
    client,
    projectPath,
    hostnames: extraHostnames(stack.studio.domain, { includeWww: false }),
    pagesDev: subdomain,
    step: 'studio',
    dryRun,
  });

  return state;
}
