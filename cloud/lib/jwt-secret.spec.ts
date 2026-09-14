import assert from 'node:assert/strict';
import test from 'node:test';
import { requireJwtSecret } from './jwt-secret.js';

test('requireJwtSecret rejects empty', () => {
  assert.throws(() => requireJwtSecret('', 'development'), /required/);
});

test('requireJwtSecret rejects placeholder in production', () => {
  assert.throws(
    () => requireJwtSecret('dev-jwt-secret-change-me', 'production'),
    /placeholder/,
  );
});

test('requireJwtSecret accepts a strong secret in production', () => {
  assert.equal(
    requireJwtSecret('a-long-random-production-secret', 'production'),
    'a-long-random-production-secret',
  );
});
