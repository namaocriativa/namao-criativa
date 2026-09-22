import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtRequestSource } from './jwt-cookie';

const STUDIO_LOOPBACK = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const CLIENT_LOOPBACK = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];

const ADMIN_LOOPBACK = [
  'http://localhost:5175',
  'http://127.0.0.1:5175',
];

/** Cloudflare Pages project for the studio (custom domain + *.pages.dev). */
export const STUDIO_PAGES_PROJECT = 'namao-studio';
/** Cloudflare Pages project for the public website. */
export const CLIENT_PAGES_PROJECT = 'namao-website';
/** Cloudflare Pages project for the platform admin. */
export const ADMIN_PAGES_PROJECT = 'namao-admin';
export const DEFAULT_STUDIO_ORIGIN = 'https://studio.namaocriativa.com.br';

export function parseOriginList(value?: string | null): string[] {
  if (!value) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(/[\s,]+/)) {
    const normalized = normalizeOrigin(part.trim());
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function primaryOrigin(value?: string | null, fallback = ''): string {
  return parseOriginList(value)[0] || fallback;
}

export function pagesProjectOrigin(project: string): string {
  return `https://${project}.pages.dev`;
}

export function isPagesProjectOrigin(origin: string, project: string): boolean {
  try {
    const url = new URL(normalizeOrigin(origin));
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    const apex = `${project.toLowerCase()}.pages.dev`;
    return host === apex || host.endsWith(`.${apex}`);
  } catch {
    return false;
  }
}

export function pagesProjectForCookie(
  source: Exclude<JwtRequestSource, 'bearer'>,
): string {
  if (source === 'studio-cookie') return STUDIO_PAGES_PROJECT;
  if (source === 'admin-cookie') return ADMIN_PAGES_PROJECT;
  return CLIENT_PAGES_PROJECT;
}

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(normalizeOrigin(origin));
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

export function allowDevLoopbackOrigins(): boolean {
  return process.env.NODE_ENV !== 'production';
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutatingMethod(method?: string | null): boolean {
  return MUTATING.has(String(method || '').toUpperCase());
}

export function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, '');
}

export function wwwTwinOrigin(origin: string): string | null {
  try {
    const url = new URL(normalizeOrigin(origin));
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return null;
    url.hostname = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    return url.origin;
  } catch {
    return null;
  }
}

export function withWwwAliases(origins: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const origin of origins) {
    if (!origin) continue;
    const normalized = normalizeOrigin(origin);
    for (const item of [normalized, wwwTwinOrigin(normalized)]) {
      if (!item || seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

export function requestOrigin(req: Pick<Request, 'headers'>): string | null {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.trim()) {
    return normalizeOrigin(origin.trim());
  }
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.trim()) {
    try {
      return new URL(referer.trim()).origin;
    } catch {
      return null;
    }
  }
  return null;
}

export function allowedOriginsForCookie(
  source: Exclude<JwtRequestSource, 'bearer'>,
  env: {
    studioUrl?: string | null;
    publicUrl?: string | null;
    adminUrl?: string | null;
  } = {},
): string[] {
  if (source === 'admin-cookie') {
    return withWwwAliases([
      ...parseOriginList(env.adminUrl || process.env.NAMAO_ADMIN_URL),
      pagesProjectOrigin(ADMIN_PAGES_PROJECT),
      ...ADMIN_LOOPBACK,
    ]);
  }
  const configured =
    source === 'studio-cookie'
      ? env.studioUrl || process.env.NAMAO_STUDIO_URL
      : env.publicUrl || process.env.NAMAO_PUBLIC_URL;
  const extra = source === 'studio-cookie' ? STUDIO_LOOPBACK : CLIENT_LOOPBACK;
  const firstParty =
    source === 'studio-cookie'
      ? [DEFAULT_STUDIO_ORIGIN, pagesProjectOrigin(STUDIO_PAGES_PROJECT)]
      : [pagesProjectOrigin(CLIENT_PAGES_PROJECT)];
  return withWwwAliases([
    ...parseOriginList(configured),
    ...firstParty,
    ...extra,
  ]);
}

export function cookieSourceForOrigin(
  origin: string | null,
  env: {
    studioUrl?: string | null;
    publicUrl?: string | null;
    adminUrl?: string | null;
  } = {},
): Exclude<JwtRequestSource, 'bearer'> | null {
  if (!origin) return null;
  if (
    allowedOriginsForCookie('admin-cookie', env).includes(origin) ||
    isPagesProjectOrigin(origin, ADMIN_PAGES_PROJECT)
  ) {
    return 'admin-cookie';
  }
  if (
    allowedOriginsForCookie('studio-cookie', env).includes(origin) ||
    isPagesProjectOrigin(origin, STUDIO_PAGES_PROJECT)
  ) {
    return 'studio-cookie';
  }
  if (
    allowedOriginsForCookie('client-cookie', env).includes(origin) ||
    isPagesProjectOrigin(origin, CLIENT_PAGES_PROJECT)
  ) {
    return 'client-cookie';
  }
  if (allowDevLoopbackOrigins() && isLoopbackOrigin(origin)) {
    try {
      const port = new URL(origin).port;
      if (port === '5175') return 'admin-cookie';
      if (port === '5173') return 'studio-cookie';
      if (port === '5174') return 'client-cookie';
    } catch {
      return null;
    }
  }
  return null;
}

export function assertCookieOrigin(
  req: Pick<Request, 'headers' | 'method'>,
  source: JwtRequestSource,
  env?: {
    studioUrl?: string | null;
    publicUrl?: string | null;
    adminUrl?: string | null;
  },
): void {
  if (source === 'bearer') return;
  const origin = requestOrigin(req);
  if (!origin) {
    if (isMutatingMethod(req.method)) {
      throw new ForbiddenException('Origem da requisição ausente');
    }
    return;
  }
  const allowed = allowedOriginsForCookie(source, env);
  if (allowed.includes(origin)) return;
  if (isPagesProjectOrigin(origin, pagesProjectForCookie(source))) return;
  if (allowDevLoopbackOrigins() && isLoopbackOrigin(origin)) return;
  throw new ForbiddenException('Origem não permitida para este cookie');
}
