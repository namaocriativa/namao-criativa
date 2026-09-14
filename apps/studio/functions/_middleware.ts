import {
  isSameStudioOrigin,
  isUnauthenticatedApiAllowed,
  safeNextPath,
} from './proxy-policy';

const STUDIO_TOKEN_COOKIE = 'namao_studio_token';

const API_PREFIXES = [
  '/auth',
  '/leads',
  '/customers',
  '/lead-discovery',
  '/enrichment',
  '/packages',
  '/locations',
  '/storage',
  '/landing',
  '/config',
  '/invites',
  '/studio',
];

const STUDIO_ROLES = new Set(['ADMIN', 'OPERATOR']);

function b64urlToBytes(value: string): Uint8Array {
  const pad = '='.repeat((4 - (value.length % 4)) % 4);
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifyStudioJwt(
  token: string,
  secret: string,
): Promise<{ role?: string } | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || !secret) return null;
  const [header, payload, signature] = parts;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlToBytes(signature) as BufferSource,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  if (!ok) return null;
  try {
    const data = JSON.parse(
      new TextDecoder().decode(b64urlToBytes(payload)),
    ) as { role?: string; exp?: number };
    if (typeof data.exp === 'number' && data.exp * 1000 <= Date.now()) {
      return null;
    }
    if (!STUDIO_ROLES.has(String(data.role || ''))) return null;
    return data;
  } catch {
    return null;
  }
}

export function readCookie(
  header: string | null,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) {
      try {
        return decodeURIComponent(rest.join('=').trim()) || null;
      } catch {
        return rest.join('=').trim() || null;
      }
    }
  }
  return null;
}

export function isApiPath(pathname: string): boolean {
  return API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isHtmlNavigation(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === '/login.html' || pathname === '/login') return true;
  if (pathname.startsWith('/assets/login')) return true;
  if (pathname.startsWith('/assets/modulepreload-polyfill')) return true;
  if (/\.(css|woff2?|png|jpe?g|gif|svg|ico|map)$/i.test(pathname)) return true;
  return false;
}

function stripSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/** Public API origin. Direct Upload often omits dashboard/wrangler plaintext vars. */
export const DEFAULT_STUDIO_API_ORIGIN = 'https://api.namaocriativa.com.br';

export function resolveStudioApiOrigin(raw?: string): string {
  return stripSlash(raw?.trim() || DEFAULT_STUDIO_API_ORIGIN);
}

function missingConfigResponse(message: string): Response {
  return Response.json({ message }, { status: 503 });
}

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: {
    JWT_SECRET?: string;
    STUDIO_API_ORIGIN?: string;
    ASSETS?: { fetch: (request: Request) => Promise<Response> };
  };
}): Promise<Response> {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const secret = env.JWT_SECRET?.trim() || '';
  const apiOrigin = resolveStudioApiOrigin(env.STUDIO_API_ORIGIN);

  if (pathname === '/login' || pathname === '/login.html') {
    if (env.ASSETS?.fetch) {
      return env.ASSETS.fetch(
        new Request(new URL('/login.html', url.origin), request),
      );
    }
    return next();
  }

  if (isPublicPath(pathname)) {
    return next();
  }

  const html = isHtmlNavigation(request);
  const api = isApiPath(pathname) && !html;

  if (api) {
    if (!apiOrigin) {
      return missingConfigResponse('STUDIO_API_ORIGIN não configurada');
    }
    if (!isSameStudioOrigin(request.url, request.headers.get('origin'))) {
      return Response.json({ message: 'Origem não permitida' }, { status: 403 });
    }
    const allowAnonymous = isUnauthenticatedApiAllowed(request.method, pathname);
    if (!allowAnonymous) {
      if (!secret) {
        return missingConfigResponse('JWT_SECRET não configurado');
      }
      const token = readCookie(
        request.headers.get('cookie'),
        STUDIO_TOKEN_COOKIE,
      );
      const payload = token ? await verifyStudioJwt(token, secret) : null;
      if (!payload) {
        return Response.json({ message: 'Não autenticado' }, { status: 401 });
      }
    }
    const target = new URL(pathname + url.search, `${apiOrigin}/`);
    const headers = new Headers(request.headers);
    headers.delete('host');
    const init: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers,
      redirect: 'manual',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      init.duplex = 'half';
    }
    return fetch(target, init);
  }

  if (!secret) {
    return missingConfigResponse('JWT_SECRET não configurado');
  }

  const token = readCookie(
    request.headers.get('cookie'),
    STUDIO_TOKEN_COOKIE,
  );
  const payload = token ? await verifyStudioJwt(token, secret) : null;

  if (!payload) {
    const login = new URL('/login', url.origin);
    login.searchParams.set('next', safeNextPath(`${pathname}${url.search}`));
    return Response.redirect(login, 302);
  }

  if (pathname.includes('.') && !pathname.endsWith('.html')) {
    return next();
  }

  const indexUrl = new URL('/index.html', url.origin);
  if (env.ASSETS?.fetch) {
    return env.ASSETS.fetch(new Request(indexUrl, request));
  }
  return next();
}
