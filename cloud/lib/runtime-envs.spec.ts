import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRuntimeEnvs } from '../stacks/runtime.js';
import type { CloudState } from './state.js';
import type { StackConfig } from './config.js';

const stack = {
  runtime: { domain: 'https://api.namaocriativa.com.br' },
} as StackConfig;

const state = {} as CloudState;

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) {
    prev[key] = process.env[key];
    const next = values[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('buildRuntimeEnvs injeta Resend quando o cloud/.env tem a chave', () => {
  withEnv(
    {
      JWT_SECRET: 'a-long-random-production-secret',
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM: 'Namão Criativa <noreply@namaocriativa.com.br>',
    },
    () => {
      const envs = buildRuntimeEnvs({
        state,
        stack,
        databaseUrl: 'postgres://namao:namao@db:5432/namao',
      });
      assert.equal(envs.RESEND_API_KEY, 're_test_key');
      assert.equal(
        envs.RESEND_FROM,
        'Namão Criativa <noreply@namaocriativa.com.br>',
      );
    },
  );
});

test('buildRuntimeEnvs omite Resend quando a chave não existe', () => {
  withEnv(
    {
      JWT_SECRET: 'a-long-random-production-secret',
      RESEND_API_KEY: undefined,
      RESEND_FROM: undefined,
    },
    () => {
      const envs = buildRuntimeEnvs({
        state,
        stack,
        databaseUrl: 'postgres://namao:namao@db:5432/namao',
      });
      assert.equal(envs.RESEND_API_KEY, undefined);
      assert.equal(envs.RESEND_FROM, undefined);
    },
  );
});
