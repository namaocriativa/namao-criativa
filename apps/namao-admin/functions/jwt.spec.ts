import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyAdminJwt } from './jwt';
import {
  isSameAdminOrigin,
  isUnauthenticatedApiAllowed,
} from './proxy-policy';

function signHs256(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

test('libera só login/logout do admin sem JWT', () => {
  assert.equal(isUnauthenticatedApiAllowed('POST', '/auth/admin/login'), true);
  assert.equal(isUnauthenticatedApiAllowed('POST', '/auth/admin/logout'), true);
  assert.equal(isUnauthenticatedApiAllowed('GET', '/auth/me'), false);
  assert.equal(isUnauthenticatedApiAllowed('POST', '/studio/tenants'), false);
  assert.equal(isUnauthenticatedApiAllowed('POST', '/auth/studio/login'), false);
});

test('rejeita Origin de outro host', () => {
  assert.equal(
    isSameAdminOrigin('http://localhost:5175/', 'http://localhost:5173'),
    false,
  );
  assert.equal(
    isSameAdminOrigin('http://localhost:5175/', 'http://localhost:5175'),
    true,
  );
});

test('middleware do admin aceita só JWT ROOT', async () => {
  const secret = 'test-admin-jwt-secret';
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const root = await verifyAdminJwt(
    signHs256(
      { sub: 'u0', email: 'root@namao.local', role: 'ROOT', exp },
      secret,
    ),
    secret,
  );
  const admin = await verifyAdminJwt(
    signHs256(
      { sub: 'u1', email: 'admin@namao.local', role: 'ADMIN', exp },
      secret,
    ),
    secret,
  );
  const operator = await verifyAdminJwt(
    signHs256(
      { sub: 'u2', email: 'op@namao.local', role: 'OPERATOR', exp },
      secret,
    ),
    secret,
  );
  assert.equal(root?.role, 'ROOT');
  assert.equal(admin, null);
  assert.equal(operator, null);
});
