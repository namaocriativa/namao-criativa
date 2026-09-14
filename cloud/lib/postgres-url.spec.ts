import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoolifyPostgresUrl,
  maskDatabaseUrl,
} from './postgres-url.js';

test('buildCoolifyPostgresUrl uses uuid hostname and encodes credentials', () => {
  const url = buildCoolifyPostgresUrl({
    user: 'namao',
    password: 'p@ss/word',
    uuid: 'abc123uuid',
    database: 'namao',
  });
  assert.equal(
    url,
    'postgresql://namao:p%40ss%2Fword@abc123uuid:5432/namao',
  );
});

test('maskDatabaseUrl hides the password', () => {
  const masked = maskDatabaseUrl(
    'postgresql://namao:secret@abc123uuid:5432/namao',
  );
  assert.match(masked, /namao:\*\*\*@abc123uuid:5432\/namao/);
});
