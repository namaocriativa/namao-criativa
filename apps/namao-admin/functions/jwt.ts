export const ADMIN_TOKEN_COOKIE = 'namao_admin_token';

function b64urlToBytes(value: string): Uint8Array {
  const pad = '='.repeat((4 - (value.length % 4)) % 4);
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifyAdminJwt(
  token: string,
  secret: string,
): Promise<{ role?: string } | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || !secret) return null;
  const [header, payload, signature] = parts;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlToBytes(signature) as BufferSource,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  if (!ok) return null;
  try {
    const data = JSON.parse(
      new TextDecoder().decode(b64urlToBytes(payload)),
    ) as { role?: string; exp?: number };
    if (typeof data.exp === 'number' && data.exp * 1000 <= Date.now()) {
      return null;
    }
    if (String(data.role || '') !== 'ROOT') return null;
    return data;
  } catch {
    return null;
  }
}

export function readCookie(
  header: string | null,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) {
      try {
        return decodeURIComponent(rest.join('=').trim()) || null;
      } catch {
        return rest.join('=').trim() || null;
      }
    }
  }
  return null;
}
