import path from 'node:path';
import { loadEnv } from 'vite';

/** URL da API no host (`PLATFORM_PORT` no .env da raiz, default 4000). */
export function resolveLocalApiUrl(repoRoot: string): string {
  const fromRoot = loadEnv('development', repoRoot, '');
  const fromPlatform = loadEnv(
    'development',
    path.join(repoRoot, 'services/platform'),
    '',
  );
  const env = { ...fromRoot, ...fromPlatform, ...process.env };
  const explicit = env.VITE_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const port = env.PLATFORM_PORT || '4000';
  return `http://localhost:${port}`;
}
