const HOST_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function parseWebsiteDomain(value: unknown): {
  domain: string | null;
  invalid: boolean;
} {
  if (value == null) return { domain: null, invalid: false };
  if (typeof value !== 'string') return { domain: null, invalid: true };
  const raw = value
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .trim()
    .toLowerCase();
  if (!raw) return { domain: null, invalid: false };
  const apex = raw.startsWith('www.') ? raw.slice(4) : raw;
  if (!HOST_RE.test(apex) || apex.length > 253) {
    return { domain: null, invalid: true };
  }
  return { domain: apex, invalid: false };
}

export function extraHostnames(apex: string | null | undefined): string[] {
  const parsed = parseWebsiteDomain(apex ?? '');
  const host = parsed.domain;
  if (!host) return [];
  return [host, `www.${host}`];
}

export function domainPlan(
  previous: string | null | undefined,
  next: string | null | undefined,
): { attach: string[]; detach: string[] } {
  const prev = new Set(extraHostnames(previous));
  const nxt = new Set(extraHostnames(next));
  return {
    attach: [...nxt].filter((host) => !prev.has(host)),
    detach: [...prev].filter((host) => !nxt.has(host)),
  };
}

export type PagesDomainApi = {
  listDomains(project: string): Promise<string[]>;
  attachDomain(project: string, hostname: string): Promise<void>;
  detachDomain(project: string, hostname: string): Promise<void>;
  ensureCname?(hostname: string, target: string): Promise<void>;
};

export async function syncPagesProjectDomains(opts: {
  api: PagesDomainApi;
  project: string;
  next: string | null | undefined;
  previous?: string | null;
  pagesDev?: string;
}): Promise<{ attached: string[]; detached: string[] }> {
  const { api, project } = opts;
  const plan = domainPlan(opts.previous, opts.next);
  const have = new Set(await api.listDomains(project));
  const attached: string[] = [];
  const detached: string[] = [];
  const pagesDev = (opts.pagesDev || `${project}.pages.dev`).replace(
    /^https?:\/\//,
    '',
  ).replace(/\/$/, '');

  for (const host of plan.detach) {
    if (!have.has(host)) continue;
    await api.detachDomain(project, host);
    have.delete(host);
    detached.push(host);
  }

  const wanted = extraHostnames(opts.next);
  for (const host of wanted) {
    if (!have.has(host)) {
      await api.attachDomain(project, host);
      have.add(host);
      attached.push(host);
    }
    if (api.ensureCname) {
      await api.ensureCname(host, pagesDev);
    }
  }

  return { attached, detached };
}
