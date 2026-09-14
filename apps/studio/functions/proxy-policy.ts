export function safeNextPath(
  raw: string | null | undefined,
  fallback = '/leads',
): string {
  const value = String(raw || '').trim();
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.includes('\\')) return fallback;
  if (value.includes('://')) return fallback;
  return value;
}

export function isUnauthenticatedApiAllowed(
  method: string,
  pathname: string,
): boolean {
  if (method.toUpperCase() !== 'POST') return false;
  return (
    pathname === '/auth/studio/login' || pathname === '/auth/studio/logout'
  );
}

export function isSameStudioOrigin(
  requestUrl: string,
  originHeader: string | null,
): boolean {
  if (!originHeader) return true;
  try {
    return new URL(originHeader).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/** Document navigation vs XHR/fetch. Fetch often sends Accept: text/html too. */
export function isHtmlNavigation(request: {
  method: string;
  headers: { get(name: string): string | null };
}): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  const dest = (request.headers.get('sec-fetch-dest') || '').toLowerCase();
  if (dest && dest !== 'document') return false;
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

const STRIP_API_PROXY_HEADERS = [
  'host',
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'content-length',
  'accept-encoding',
  'content-encoding',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-ew-via',
  'cdn-loop',
  'true-client-ip',
];

export function headersForStudioApiProxy(
  request: { headers: Headers },
  forwardedOrigin: string | null,
): Headers {
  const headers = new Headers(request.headers);
  for (const name of STRIP_API_PROXY_HEADERS) headers.delete(name);
  if (forwardedOrigin) headers.set('origin', forwardedOrigin);
  return headers;
}

export function studioProxyStatus(status: number): number {
  // Custom-domain Pages replaces 502/503/504 with an HTML/text error page.
  if (status === 502 || status === 503 || status === 504) return 400;
  return status;
}

export async function fetchStudioApi(
  request: Request,
  target: URL,
  forwardedOrigin: string | null,
): Promise<Response> {
  const headers = headersForStudioApiProxy(request, forwardedOrigin);
  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }
  try {
    const res = await fetch(target, init);
    if (res.status < 500) return res;
    const payload = await res.arrayBuffer();
    const type = res.headers.get('content-type') || 'application/json; charset=utf-8';
    return new Response(payload, {
      status: studioProxyStatus(res.status),
      headers: {
        'content-type': type,
        'cache-control': 'no-store',
      },
    });
  } catch {
    return Response.json(
      { message: 'API indisponível. Tente de novo em instantes.' },
      { status: 400 },
    );
  }
}

/**
 * Pages pretty URLs 308 `/file.html` → `/file`. Fetch the pretty path from
 * ASSETS or the 308 loops (`/login.html` → `/login` → `/login.html`).
 */
export function pagesPrettyPath(htmlPath: string): string {
  if (!htmlPath.endsWith('.html')) return htmlPath;
  const without = htmlPath.slice(0, -'.html'.length);
  return without === '/index' ? '/' : without;
}

export const DEFAULT_CANONICAL_STUDIO_ORIGIN =
  'https://studio.namaocriativa.com.br';

export function isStudioPagesDevHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'namao-studio.pages.dev' ||
    host.endsWith('.namao-studio.pages.dev')
  );
}

function originFromReferer(refererHeader?: string | null): string | null {
  if (!refererHeader?.trim()) return null;
  try {
    return new URL(refererHeader.trim()).origin;
  } catch {
    return null;
  }
}

function canonicalStudioOrigin(canonicalStudioUrl?: string | null): string {
  const first = (canonicalStudioUrl || DEFAULT_CANONICAL_STUDIO_ORIGIN)
    .split(/[\s,]+/)
    .map((item) => item.trim().replace(/\/$/, ''))
    .find(Boolean);
  return first || DEFAULT_CANONICAL_STUDIO_ORIGIN;
}

/** Maps the Pages default host to the canonical studio origin for the API cookie check. */
export function originForStudioApiProxy(
  originHeader: string | null,
  canonicalStudioUrl?: string | null,
  refererHeader?: string | null,
): string | null {
  const raw = originHeader?.trim() || originFromReferer(refererHeader);
  if (!raw) return originHeader;
  try {
    const origin = new URL(raw).origin;
    if (!isStudioPagesDevHost(new URL(origin).hostname)) return origin;
    return new URL(canonicalStudioOrigin(canonicalStudioUrl)).origin;
  } catch {
    return originHeader;
  }
}
