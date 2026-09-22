import type { CookieOptions, Request } from 'express';
import { cookieSourceForOrigin, requestOrigin } from './cookie-origin';
import {
  ADMIN_TOKEN_COOKIE,
  CLIENT_TOKEN_COOKIE,
  STUDIO_TOKEN_COOKIE,
} from './roles';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
export const STUDIO_REMEMBER_EXPIRES_IN = '30d' as const;
export const STUDIO_SESSION_EXPIRES_IN = '12h' as const;
export type StudioJwtExpiresIn =
  | typeof STUDIO_REMEMBER_EXPIRES_IN
  | typeof STUDIO_SESSION_EXPIRES_IN;

export type JwtRequestSource =
  | 'bearer'
  | 'studio-cookie'
  | 'admin-cookie'
  | 'client-cookie';

export type InspectedJwt = {
  token: string;
  source: JwtRequestSource;
};

type CookieRequest = Pick<Request, 'headers'> & {
  cookies?: Record<string, string>;
  protocol?: string;
  secure?: boolean;
};

export function readCookie(
  req: CookieRequest,
  name: string,
): string | null {
  const fromParser = req.cookies?.[name]?.trim();
  if (fromParser) return fromParser;
  const header = req.headers.cookie;
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

export function inspectJwtFromRequest(req: CookieRequest): InspectedJwt | null {
  const header = req.headers.authorization;
  if (typeof header === 'string' && /^Bearer\s+/i.test(header)) {
    const token = header.replace(/^Bearer\s+/i, '').trim();
    if (token) return { token, source: 'bearer' };
  }
  const admin = readCookie(req, ADMIN_TOKEN_COOKIE);
  const studio = readCookie(req, STUDIO_TOKEN_COOKIE);
  const client = readCookie(req, CLIENT_TOKEN_COOKIE);
  const preferred = cookieSourceForOrigin(requestOrigin(req));
  if (preferred === 'admin-cookie') {
    return admin ? { token: admin, source: 'admin-cookie' } : null;
  }
  if (preferred === 'studio-cookie') {
    return studio ? { token: studio, source: 'studio-cookie' } : null;
  }
  if (preferred === 'client-cookie') {
    return client ? { token: client, source: 'client-cookie' } : null;
  }
  if (studio) return { token: studio, source: 'studio-cookie' };
  if (admin) return { token: admin, source: 'admin-cookie' };
  if (client) return { token: client, source: 'client-cookie' };
  return null;
}

export function extractJwtFromRequest(req: CookieRequest): string | null {
  return inspectJwtFromRequest(req)?.token ?? null;
}

export function cookieJwtToken(req: CookieRequest): string | null {
  return (
    readCookie(req, CLIENT_TOKEN_COOKIE) ||
    readCookie(req, STUDIO_TOKEN_COOKIE) ||
    readCookie(req, ADMIN_TOKEN_COOKIE)
  );
}

export function authCookieOptions(
  req?: CookieRequest,
  opts?: { rememberMe?: boolean },
): CookieOptions {
  const forwarded = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const https =
    process.env.NODE_ENV === 'production' ||
    Boolean(req?.secure) ||
    forwarded === 'https' ||
    req?.protocol === 'https';
  const options: CookieOptions = {
    httpOnly: true,
    secure: https,
    sameSite: 'lax',
    path: '/',
  };
  if (opts?.rememberMe === true) {
    options.maxAge = THIRTY_DAYS_MS;
  } else if (opts?.rememberMe === false) {
    // cookie de sessão: some ao fechar o navegador
  } else {
    options.maxAge = WEEK_MS;
  }
  return options;
}

export function studioCookieOptions(
  req?: CookieRequest,
  opts?: { rememberMe?: boolean },
): CookieOptions {
  return authCookieOptions(req, opts);
}
