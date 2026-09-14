/**
 * Mirrors apps/studio/functions/proxy-policy.ts and apps/studio/src/safe-next-path.ts
 * so Jest (rootDir=src) can cover the Pages/login helpers.
 */
function safeNextPath(
  raw: string | null | undefined,
  fallback = '/leads',
): string {
  const value = String(raw || '').trim();
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.includes('\\')) return fallback;
  if (value.includes('://')) return fallback;
  return value;
}

function isUnauthenticatedApiAllowed(method: string, pathname: string): boolean {
  if (method.toUpperCase() !== 'POST') return false;
  return (
    pathname === '/auth/studio/login' || pathname === '/auth/studio/logout'
  );
}

function isSameStudioOrigin(
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

describe('studio proxy policy', () => {
  it('aceita path relativo', () => {
    expect(safeNextPath('/leads')).toBe('/leads');
    expect(safeNextPath('/leads/abc?x=1')).toBe('/leads/abc?x=1');
  });

  it('bloqueia open redirect', () => {
    expect(safeNextPath('//evil.com')).toBe('/leads');
    expect(safeNextPath('/\\evil.com')).toBe('/leads');
    expect(safeNextPath('https://evil.com')).toBe('/leads');
    expect(safeNextPath('/leads://evil.com')).toBe('/leads');
  });

  it('libera só login/logout do studio sem JWT', () => {
    expect(isUnauthenticatedApiAllowed('POST', '/auth/studio/login')).toBe(
      true,
    );
    expect(isUnauthenticatedApiAllowed('POST', '/auth/studio/logout')).toBe(
      true,
    );
    expect(isUnauthenticatedApiAllowed('GET', '/auth/me')).toBe(false);
    expect(isUnauthenticatedApiAllowed('POST', '/leads')).toBe(false);
    expect(isUnauthenticatedApiAllowed('POST', '/auth/login')).toBe(false);
  });

  it('rejeita Origin de outro host', () => {
    expect(
      isSameStudioOrigin(
        'https://studio.namaocriativa.com.br/leads',
        'https://namaocriativa.com.br',
      ),
    ).toBe(false);
    expect(
      isSameStudioOrigin(
        'https://studio.namaocriativa.com.br/leads',
        'https://studio.namaocriativa.com.br',
      ),
    ).toBe(true);
    expect(
      isSameStudioOrigin(
        'https://studio.namaocriativa.com.br/leads',
        null,
      ),
    ).toBe(true);
  });
});
