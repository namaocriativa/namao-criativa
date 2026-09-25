import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const WEBSITE_DEPLOY_TYPES = ['cloudflare', 'vercel'] as const;
export type WebsiteDeployType = (typeof WEBSITE_DEPLOY_TYPES)[number];

export const WEBSITE_FRAMEWORKS = ['next', 'vite'] as const;
export type WebsiteFramework = (typeof WEBSITE_FRAMEWORKS)[number];

export type WebsiteProject = {
  id: string;
  title: string;
  dir: string;
  repo: string;
  framework: WebsiteFramework;
  cloudflareProjectName: string;
  vercelProjectName: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isWebsiteDeployType(value: unknown): value is WebsiteDeployType {
  return (
    typeof value === 'string' &&
    (WEBSITE_DEPLOY_TYPES as readonly string[]).includes(value)
  );
}

export function parseWebsiteCatalog(value: unknown): WebsiteProject[] {
  const raw = asRecord(value);
  const items = Array.isArray(raw?.projects) ? raw.projects : [];
  const seen = new Set<string>();
  const projects: WebsiteProject[] = [];
  for (const item of items) {
    const row = asRecord(item);
    if (!row) continue;
    const id = text(row.id);
    const title = text(row.title) || id;
    const dir = text(row.dir) || id;
    const repo = text(row.repo);
    const framework = text(row.framework);
    if (!id || !repo || seen.has(id)) continue;
    if (!(WEBSITE_FRAMEWORKS as readonly string[]).includes(framework)) continue;
    seen.add(id);
    projects.push({
      id,
      title,
      dir,
      repo,
      framework: framework as WebsiteFramework,
      cloudflareProjectName: text(row.cloudflareProjectName) || id,
      vercelProjectName: text(row.vercelProjectName) || id,
    });
  }
  return projects;
}

export function resolveWebsiteCatalogPath(
  cwd = process.cwd(),
  envPath = process.env.WEBSITES_CATALOG_PATH,
): string | null {
  const candidates = [
    envPath,
    join(cwd, 'websites', 'catalog.json'),
    join(cwd, '..', '..', 'websites', 'catalog.json'),
    join(cwd, '..', 'websites', 'catalog.json'),
  ].filter((item): item is string => Boolean(item));
  return candidates.find((item) => existsSync(item)) || null;
}

export function loadWebsiteCatalog(path = resolveWebsiteCatalogPath()): WebsiteProject[] {
  if (!path) return [];
  try {
    return parseWebsiteCatalog(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return [];
  }
}

export function findWebsiteProject(
  projectId: string,
  projects = loadWebsiteCatalog(),
): WebsiteProject | undefined {
  return projects.find((item) => item.id === projectId);
}
