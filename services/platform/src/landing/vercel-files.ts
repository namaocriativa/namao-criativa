import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export type DistFile = {
  file: string;
  sha: string;
  size: number;
  data: Buffer;
};

const SKIP_NAMES = new Set(['.ds_store', '.gitkeep']);

export function vercelProjectName(slug: string, prefix = 'ld-'): string {
  const body = String(slug || 'site')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const raw = `${prefix}${body || 'site'}`
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const clipped = raw.slice(0, 100).replace(/-+$/g, '');
  return clipped || 'ld-site';
}

export function toVercelPath(relative: string): string {
  return relative.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function sha1Buffer(data: Buffer): string {
  return createHash('sha1').update(data).digest('hex');
}

export async function collectDistFiles(distDir: string): Promise<DistFile[]> {
  const files: DistFile[] = [];
  await walk(distDir, distDir, files);
  return files;
}

async function walk(root: string, current: string, out: DistFile[]) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_NAMES.has(entry.name.toLowerCase())) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(root, absolute, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const data = await fs.readFile(absolute);
    out.push({
      file: toVercelPath(path.relative(root, absolute)),
      sha: sha1Buffer(data),
      size: data.byteLength,
      data,
    });
  }
}
