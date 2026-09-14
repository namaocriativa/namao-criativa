import type { CookieOptions, Request } from 'express';
import { CLIENT_TOKEN_COOKIE, STUDIO_TOKEN_COOKIE } from './roles';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type JwtRequestSource = 'bearer' | 'studio-cookie' | 'client-cookie';

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
  const studio = readCookie(req, STUDIO_TOKEN_COOKIE);
  if (studio) return { token: studio, source: 'studio-cookie' };
  const client = readCookie(req, CLIENT_TOKEN_COOKIE);
  if (client) return { token: client, source: 'client-cookie' };
  return null;
}

export function extractJwtFromRequest(req: CookieRequest): string | null {
  return inspectJwtFromRequest(req)?.token ?? null;
}

export function cookieJwtToken(req: CookieRequest): string | null {
  return (
    readCookie(req, CLIENT_TOKEN_COOKIE) ||
    readCookie(req, STUDIO_TOKEN_COOKIE)
  );
}

export function authCookieOptions(req?: CookieRequest): CookieOptions {
  const forwarded = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const https =
    process.env.NODE_ENV === 'production' ||
    Boolean(req?.secure) ||
    forwarded === 'https' ||
    req?.protocol === 'https';
  return {
    httpOnly: true,
    secure: https,
    sameSite: 'lax',
    path: '/',
    maxAge: WEEK_MS,
  };
}

export function studioCookieOptions(req?: CookieRequest): CookieOptions {
  return authCookieOptions(req);
}
