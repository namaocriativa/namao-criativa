import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertStudioPagesEnv,
  productionEnvKeys,
} from './studio-pages-env.js';

test('productionEnvKeys includes secrets without values', () => {
  const keys = productionEnvKeys({
    deployment_configs: {
      production: {
        env_vars: {
          JWT_SECRET: { type: 'secret_text' },
          STUDIO_API_ORIGIN: {
            type: 'plain_text',
            value: 'https://api.example.com',
          },
        },
      },
    },
  });
  assert.deepEqual(keys.sort(), ['JWT_SECRET', 'STUDIO_API_ORIGIN']);
});

test('assertStudioPagesEnv fails closed', () => {
  assert.throws(() => assertStudioPagesEnv(['STUDIO_API_ORIGIN']), /JWT_SECRET/);
});
