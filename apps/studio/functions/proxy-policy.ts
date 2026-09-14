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
