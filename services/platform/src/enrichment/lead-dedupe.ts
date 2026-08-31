/**
 * Normaliza website para comparação de dedupe:
 * host sem www, lowercase, sem path/query/porta default.
 */
export function websiteDedupeKey(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(
      trimmed.startsWith('http') ? trimmed : `https://${trimmed}`,
    );
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (!host) return null;
    return host;
  } catch {
    return null;
  }
}

export function namePlaceDedupeKey(opts: {
  name?: string | null;
  city?: string | null;
  state?: string | null;
}): string | null {
  const name = String(opts.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!name) return null;
  const city = String(opts.city || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const state = String(opts.state || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .trim();
  return `${name}|${city}|${state}`;
}
