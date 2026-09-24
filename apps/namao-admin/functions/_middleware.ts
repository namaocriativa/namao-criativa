import {
  fetchAdminApi,
  isHtmlNavigation,
  isPublicPath,
  isSameAdminOrigin,
  isUnauthenticatedApiAllowed,
  originForAdminApiProxy,
  pagesPrettyPath,
  safeNextPath,
} from './proxy-policy';
import { ADMIN_TOKEN_COOKIE, readCookie, verifyAdminJwt } from './jwt';

const API_PREFIXES = ['/auth', '/studio'];

export const DEFAULT_ADMIN_API_ORIGIN = 'https://api.namaocriativa.com.br';

export function isApiPath(pathname: string): boolean {
  return API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function stripSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function resolveAdminApiOrigin(raw?: string): string {
  return stripSlash(raw?.trim() || DEFAULT_ADMIN_API_ORIGIN);
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
    NAMAO_ADMIN_URL?: string;
    ASSETS?: { fetch: (request: Request) => Promise<Response> };
  };
}): Promise<Response> {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const secret = env.JWT_SECRET?.trim() || '';
  const apiOrigin = resolveAdminApiOrigin(env.STUDIO_API_ORIGIN);

  if (pathname === '/login' || pathname === '/login.html') {
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
    if (!isSameAdminOrigin(request.url, request.headers.get('origin'))) {
      return Response.json({ message: 'Origem não permitida' }, { status: 403 });
    }
    const allowAnonymous = isUnauthenticatedApiAllowed(request.method, pathname);
    if (!allowAnonymous) {
      if (!secret) {
        return missingConfigResponse('JWT_SECRET não configurado');
      }
      const token = readCookie(
        request.headers.get('cookie'),
        ADMIN_TOKEN_COOKIE,
      );
      let payload: { role?: string } | null = null;
      try {
        payload = token ? await verifyAdminJwt(token, secret) : null;
      } catch {
        payload = null;
      }
      if (!payload) {
        return Response.json({ message: 'Não autenticado' }, { status: 401 });
      }
    }
    const target = new URL(pathname + url.search, `${apiOrigin}/`);
    const forwardedOrigin = originForAdminApiProxy(
      request.headers.get('origin'),
      env.NAMAO_ADMIN_URL,
      request.headers.get('referer'),
    );
    return fetchAdminApi(request, target, forwardedOrigin);
  }

  if (!secret) {
    return missingConfigResponse('JWT_SECRET não configurado');
  }

  const token = readCookie(request.headers.get('cookie'), ADMIN_TOKEN_COOKIE);
  let payload: { role?: string } | null = null;
  try {
    payload = token ? await verifyAdminJwt(token, secret) : null;
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
