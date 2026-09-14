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
  } = {},
): string[] {
  const configured =
    source === 'studio-cookie'
      ? env.studioUrl || process.env.NAMAO_STUDIO_URL
      : env.publicUrl || process.env.NAMAO_PUBLIC_URL;
  const extra = source === 'studio-cookie' ? STUDIO_LOOPBACK : CLIENT_LOOPBACK;
  return withWwwAliases(
    [configured, ...extra]
      .map((item) => (item ? normalizeOrigin(item) : ''))
      .filter(Boolean),
  );
}

export function assertCookieOrigin(
  req: Pick<Request, 'headers' | 'method'>,
  source: JwtRequestSource,
  env?: { studioUrl?: string | null; publicUrl?: string | null },
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
  if (allowDevLoopbackOrigins() && isLoopbackOrigin(origin)) return;
  throw new ForbiddenException('Origem não permitida para este cookie');
}
