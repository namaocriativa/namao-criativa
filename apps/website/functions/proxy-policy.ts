/** Same-origin API routes proxied to the Namão platform (mirrors Vite). */
export const API_PREFIXES = [
  '/auth',
  '/invites',
  '/leads',
  '/dashboard/analytics',
  '/invite-requests',
  '/namao-chat',
  '/proposal',
] as const;

export const DEFAULT_WEBSITE_API_ORIGIN = 'https://api.namaocriativa.com.br';

export function isApiPath(pathname: string): boolean {
  return API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isHtmlNavigation(request: {
  method: string;
  headers: { get(name: string): string | null };
}): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

export function hostWithoutWww(hostname: string): string {
  return hostname.replace(/^www\./i, '');
}

export function isWwwApexPair(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return (
      left.protocol === right.protocol &&
      hostWithoutWww(left.hostname) === hostWithoutWww(right.hostname)
    );
  } catch {
    return false;
  }
}

export function isSameWebsiteOrigin(
  requestUrl: string,
  originHeader: string | null,
): boolean {
  if (!originHeader) return true;
  try {
    const requestOrigin = new URL(requestUrl).origin;
    const origin = new URL(originHeader).origin;
    if (origin === requestOrigin) return true;
    return isWwwApexPair(origin, requestOrigin);
  } catch {
    return false;
  }
}

export const CANONICAL_WEBSITE_HOST = 'namaocriativa.com.br';
export const CANONICAL_WEBSITE_ORIGIN = `https://${CANONICAL_WEBSITE_HOST}`;

/** 301 www → apex. Ignores localhost, pages.dev and already-canonical hosts. */
export function canonicalWebsiteRedirect(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl);
    if (url.hostname.toLowerCase() !== `www.${CANONICAL_WEBSITE_HOST}`) {
      return null;
    }
    url.hostname = CANONICAL_WEBSITE_HOST;
    url.protocol = 'https:';
    url.port = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function rewritePublicOriginHeaders(headers: Headers): void {
  const origin = headers.get('origin');
  if (
    origin &&
    isWwwApexPair(origin, CANONICAL_WEBSITE_ORIGIN)
  ) {
    headers.set('origin', CANONICAL_WEBSITE_ORIGIN);
  }
  const referer = headers.get('referer');
  if (!referer) return;
  try {
    const url = new URL(referer);
    if (hostWithoutWww(url.hostname) === 'namaocriativa.com.br') {
      url.hostname = 'namaocriativa.com.br';
      headers.set('referer', url.toString());
    }
  } catch {
    /* keep */
  }
}

export function resolveWebsiteApiOrigin(raw?: string): string {
  return (raw?.trim() || DEFAULT_WEBSITE_API_ORIGIN).replace(/\/$/, '');
}
