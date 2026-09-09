import { readFileSync } from 'fs';
import { join } from 'path';
import { PLATFORM_ENV_CATALOG } from './env-catalog';
import { EnvStatusService } from './env-status.service';

function keysFromExample(): string[] {
  const text = readFileSync(join(__dirname, '../../.env.example'), 'utf8');
  return [...text.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((match) => match[1]);
}

describe('EnvStatusService', () => {
  const values: Record<string, string | undefined> = {};
  const config = {
    get: jest.fn((key: string) => values[key]),
  };
  const service = new EnvStatusService(config as never);

  beforeEach(() => {
    for (const key of Object.keys(values)) delete values[key];
    config.get.mockClear();
  });

  it('cobre as chaves do .env.example', () => {
    const catalog = new Set(PLATFORM_ENV_CATALOG.map((entry) => entry.key));
    expect([...catalog]).toHaveLength(PLATFORM_ENV_CATALOG.length);
    expect([...keysFromExample()].sort()).toEqual([...catalog].sort());
  });

  it('marca vazias como ausentes e preenchidas como OK', () => {
    values.DATABASE_URL = 'postgresql://namao:namao@localhost:5432/namao';
    values.GEMINI_API_KEY = '  ';
    const payload = service.list();
    const db = payload.items.find((item) => item.key === 'DATABASE_URL');
    const gemini = payload.items.find((item) => item.key === 'GEMINI_API_KEY');
    expect(db?.present).toBe(true);
    expect(db?.ok).toBe(true);
    expect(gemini?.present).toBe(false);
    expect(gemini?.ok).toBe(false);
    expect(payload.counts.ok).toBe(1);
    expect(payload.counts.missingRequired).toBeGreaterThanOrEqual(1);
  });

  it('não vaza valor de secret', () => {
    values.GEMINI_API_KEY = 'secret-key';
    values.NAMAO_PUBLIC_URL = 'http://localhost:5174';
    const payload = service.list();
    const gemini = payload.items.find((item) => item.key === 'GEMINI_API_KEY');
    const url = payload.items.find((item) => item.key === 'NAMAO_PUBLIC_URL');
    expect(gemini?.present).toBe(true);
    expect(gemini?.value).toBeUndefined();
    expect(url?.value).toBe('http://localhost:5174');
  });

  it('aceita VERCEL_ORG_ID no lugar de VERCEL_TEAM_ID', () => {
    values.VERCEL_ORG_ID = 'team_123';
    const payload = service.list();
    const team = payload.items.find((item) => item.key === 'VERCEL_TEAM_ID');
    expect(team?.present).toBe(true);
    expect(team?.value).toBe('team_123');
  });
});
