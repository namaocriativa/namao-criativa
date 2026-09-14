import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCoolifyPostgresUrl,
  buildCoolifyRedisUrl,
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

test('buildCoolifyPostgresUrl appends a Prisma schema', () => {
  const url = buildCoolifyPostgresUrl({
    user: 'namao',
    password: 'secret',
    uuid: 'abc123uuid',
    database: 'namao',
    schema: 'evolution_api',
  });
  assert.equal(
    url,
    'postgresql://namao:secret@abc123uuid:5432/namao?schema=evolution_api',
  );
});

test('buildCoolifyRedisUrl uses uuid hostname and a db index', () => {
  assert.equal(
    buildCoolifyRedisUrl({
      password: 'p@ss',
      uuid: 'redisuuid',
      db: 1,
    }),
    'redis://:p%40ss@redisuuid:6379/1',
  );
});
