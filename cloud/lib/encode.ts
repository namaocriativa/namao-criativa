import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Base64-encode a compose YAML file for Coolify `docker_compose_raw`. */
export function encodeComposeFile(relativePath: string): string {
  const absolute = join(root, relativePath);
  const raw = readFileSync(absolute, 'utf8');
  return Buffer.from(raw, 'utf8').toString('base64');
}

export function cloudRoot(): string {
  return root;
}
