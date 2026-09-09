import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cloudRoot } from './encode.js';

export type WebsiteProxyOrigins = {
  apiOrigin: string;
};

export function redirectsPath(): string {
  return join(cloudRoot(), '..', 'apps', 'website', 'public', '_redirects');
}

function stripSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** Cloudflare Pages 200 rewrites — same-origin proxy (espelha o proxy do Vite). */
export function buildPagesRedirects(opts: WebsiteProxyOrigins): string {
  const api = stripSlash(opts.apiOrigin);
  const lines: string[] = [
    '# Generated — do not commit. Same-origin proxy for the Namão API.',
  ];

  if (api) {
    lines.push(
      `/auth/*            ${api}/auth/:splat  200`,
      `/invites/*         ${api}/invites/:splat  200`,
      `/leads/*           ${api}/leads/:splat  200`,
      `/dashboard/*       ${api}/dashboard/:splat  200`,
      `/invite-requests   ${api}/invite-requests  200`,
      `/invite-requests/* ${api}/invite-requests/:splat  200`,
      `/namao-chat        ${api}/namao-chat  200`,
      `/namao-chat/*      ${api}/namao-chat/:splat  200`,
    );
  }

  return `${lines.join('\n')}\n`;
}

export function resolveWebsiteProxyOrigins(): WebsiteProxyOrigins {
  const legacy =
    process.env.WEBSITE_RUNTIME_ORIGIN?.trim() ||
    process.env.WEBSITE_PLATFORM_ORIGIN?.trim() ||
    '';
  return {
    apiOrigin: process.env.WEBSITE_API_ORIGIN?.trim() || legacy,
  };
}

export function writeWebsiteRedirects(opts?: WebsiteProxyOrigins): {
  path: string;
  written: boolean;
} {
  const origins = opts ?? resolveWebsiteProxyOrigins();
  const path = redirectsPath();
  const hasAny = Boolean(origins.apiOrigin);

  if (!hasAny) {
    if (existsSync(path)) unlinkSync(path);
    return { path, written: false };
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buildPagesRedirects(origins), 'utf8');
  return { path, written: true };
}
