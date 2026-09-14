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

const DEFAULT_CANONICAL_STUDIO_ORIGIN =
  'https://studio.namaocriativa.com.br';

function isStudioPagesDevHost(hostname: string): boolean {
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

function originForStudioApiProxy(
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

  it('reescreve pages.dev para a origem canônica do studio', () => {
    expect(
      originForStudioApiProxy('https://namao-studio.pages.dev', null),
    ).toBe('https://studio.namaocriativa.com.br');
    expect(
      originForStudioApiProxy(
        'https://preview.namao-studio.pages.dev',
        'https://studio.example.com',
      ),
    ).toBe('https://studio.example.com');
    expect(
      originForStudioApiProxy(
        null,
        null,
        'https://namao-studio.pages.dev/config/llm',
      ),
    ).toBe('https://studio.namaocriativa.com.br');
    expect(
      originForStudioApiProxy(
        'https://studio.namaocriativa.com.br',
        null,
      ),
    ).toBe('https://studio.namaocriativa.com.br');
    expect(originForStudioApiProxy('https://evil.pages.dev', null)).toBe(
      'https://evil.pages.dev',
    );
  });
});
