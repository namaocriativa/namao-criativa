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
