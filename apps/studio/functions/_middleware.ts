import {
  fetchStudioApi,
  isHtmlNavigation,
  isSameStudioOrigin,
  isStoragePath,
  isUnauthenticatedApiAllowed,
  isPublicPath,
  originForStudioApiProxy,
  pagesPrettyPath,
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
  '/calendar',
  '/public',
  '/image-projects',
  '/image-models',
  '/video-projects',
      '/video-models',
      '/creative',
      '/locations',
  '/storage',
  '/landing',
  '/config',
  '/invites',
  '/studio',
];

const STUDIO_ROLES = new Set(['ROOT', 'ADMIN', 'OPERATOR']);

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
    NAMAO_STUDIO_URL?: string;
    ASSETS?: { fetch: (request: Request) => Promise<Response> };
  };
}): Promise<Response> {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const secret = env.JWT_SECRET?.trim() || '';
  const apiOrigin = resolveStudioApiOrigin(env.STUDIO_API_ORIGIN);

  if (pathname === '/login' || pathname === '/login.html') {
    return next();
  }

  if (isPublicPath(pathname) && !isStoragePath(pathname)) {
    return next();
  }

  const html = isHtmlNavigation(request);
  const api = isApiPath(pathname) && (!html || isStoragePath(pathname));

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
      let payload: { role?: string } | null = null;
      try {
        payload = token ? await verifyStudioJwt(token, secret) : null;
      } catch {
        payload = null;
      }
      if (!payload) {
        return Response.json({ message: 'Não autenticado' }, { status: 401 });
      }
    }
    const target = new URL(pathname + url.search, `${apiOrigin}/`);
    const forwardedOrigin = originForStudioApiProxy(
      request.headers.get('origin'),
      env.NAMAO_STUDIO_URL,
      request.headers.get('referer'),
    );
    return fetchStudioApi(request, target, forwardedOrigin);
  }

  if (!secret) {
    return missingConfigResponse('JWT_SECRET não configurado');
  }

  const token = readCookie(
    request.headers.get('cookie'),
    STUDIO_TOKEN_COOKIE,
  );
  let payload: { role?: string } | null = null;
  try {
    payload = token ? await verifyStudioJwt(token, secret) : null;
  } catch {
    payload = null;
  }

  if (!payload) {
    const login = new URL('/login', url.origin);
    login.searchParams.set('next', safeNextPath(`${pathname}${url.search}`));
    return Response.redirect(login, 302);
  }

  if (pathname.includes('.') && !pathname.endsWith('.html')) {
    return next();
  }

  if (env.ASSETS?.fetch) {
    return env.ASSETS.fetch(
      new Request(new URL(pagesPrettyPath('/index.html'), url.origin), {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: request.headers,
        redirect: 'manual',
      }),
    );
  }
  return next();
}
