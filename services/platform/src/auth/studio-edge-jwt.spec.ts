import { JwtService } from '@nestjs/jwt';

const STUDIO_ROLES = new Set(['ROOT', 'ADMIN', 'OPERATOR']);

function b64urlToBytes(value: string): Uint8Array {
  const pad = '='.repeat((4 - (value.length % 4)) % 4);
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyStudioJwt(
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
    if (!STUDIO_ROLES.has(String(data.role || ''))) return null;
    return data;
  } catch {
    return null;
  }
}

describe('studio JWT na borda (HS256)', () => {
  const secret = 'test-studio-jwt-secret';
  const jwt = new JwtService({
    secret,
    signOptions: { expiresIn: '7d' },
  });

  it('aceita token ROOT emitido pelo Nest', async () => {
    const token = jwt.sign({
      sub: 'u0',
      email: 'root@namao.local',
      role: 'ROOT',
    });
    const payload = await verifyStudioJwt(token, secret);
    expect(payload?.role).toBe('ROOT');
  });

  it('aceita token ADMIN emitido pelo Nest', async () => {
    const token = jwt.sign({
      sub: 'u1',
      email: 'admin@namao.local',
      role: 'ADMIN',
    });
    const payload = await verifyStudioJwt(token, secret);
    expect(payload?.role).toBe('ADMIN');
  });

  it('rejeita CLIENT', async () => {
    const token = jwt.sign({
      sub: 'u2',
      email: 'cli@loja.com',
      role: 'CLIENT',
    });
    await expect(verifyStudioJwt(token, secret)).resolves.toBeNull();
  });

  it('rejeita assinatura errada', async () => {
    const token = jwt.sign({
      sub: 'u1',
      email: 'admin@namao.local',
      role: 'ADMIN',
    });
    await expect(verifyStudioJwt(token, 'outra-secret')).resolves.toBeNull();
  });
});
