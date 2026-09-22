import { createHmac, timingSafeEqual } from 'crypto';

const DEFAULT_TTL_SECONDS = 2 * 60 * 60;

export function signCalendarAssetUrl(opts: {
  origin: string;
  assetId: string;
  secret: string;
  ttlSeconds?: number;
  now?: Date;
}): { url: string; exp: number; sig: string } {
  const origin = opts.origin.replace(/\/$/, '');
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = opts.now ?? new Date();
  const exp = Math.floor(now.getTime() / 1000) + ttl;
  const sig = signCalendarAsset(opts.assetId, exp, opts.secret);
  const url = `${origin}/public/calendar-assets/${encodeURIComponent(opts.assetId)}?exp=${exp}&sig=${sig}`;
  return { url, exp, sig };
}

export function signCalendarAsset(
  assetId: string,
  exp: number,
  secret: string,
): string {
  return createHmac('sha256', secret).update(`${assetId}.${exp}`).digest('hex');
}

export function verifyCalendarAssetSig(opts: {
  assetId: string;
  exp: string | number;
  sig: string;
  secret: string;
  now?: Date;
}): boolean {
  const exp = Number(opts.exp);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  const now = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  if (exp < now) return false;
  const expected = signCalendarAsset(opts.assetId, exp, opts.secret);
  const given = String(opts.sig || '');
  if (given.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function isPubliclyReachableOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host !== 'localhost' &&
      host !== '127.0.0.1' &&
      host !== '::1' &&
      !host.endsWith('.local')
    );
  } catch {
    return false;
  }
}
