export function hostnameFromOrigin(origin?: string | null): string {
  const raw = String(origin || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return url.hostname.replace(/\.$/, '');
  } catch {
    return raw
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .replace(/\.$/, '');
  }
}
