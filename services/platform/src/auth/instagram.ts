export function normalizeInstagram(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const withoutAt = trimmed.replace(/^@+/, '');
  const withProto = /^https?:\/\//i.test(withoutAt)
    ? withoutAt
    : `https://${withoutAt}`;

  try {
    const url = new URL(withProto);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'instagram.com' || host === 'instagr.am') {
      const handle = url.pathname.split('/').filter(Boolean)[0] || '';
      return decodeURIComponent(handle).replace(/^@+/, '').replace(/\/+$/, '');
    }
  } catch {
    // not a URL — treat as handle
  }

  return withoutAt.split(/[/?#]/)[0]?.replace(/^@+/, '') ?? '';
}

export const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

export function instagramProfileUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}
