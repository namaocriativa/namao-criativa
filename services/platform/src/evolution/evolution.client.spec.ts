import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EvolutionClient } from './evolution.client';

jest.mock('axios');

const post = axios.post as jest.MockedFunction<typeof axios.post>;

function makeClient(env: Record<string, string | undefined>) {
  const config = {
    get: jest.fn((key: string) => env[key]),
  };
  return new EvolutionClient(config as unknown as ConfigService);
}

describe('EvolutionClient', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('marca configurado e envia via mock sem chamar a HTTP', async () => {
    const client = makeClient({
      NODE_ENV: 'development',
      EVOLUTION_MOCK: '1',
    });

    expect(client.mockEnabled()).toBe(true);
    expect(client.configured()).toBe(true);

    const result = await client.sendText({
      phone: '+55 19 99730-6695',
      text: 'olá',
    });

    expect(post).not.toHaveBeenCalled();
    expect(result).toEqual({
      skipped: false,
      ok: true,
      data: { mock: true, number: '5519997306695', text: 'olá' },
    });
  });

  it('aceita EVOLUTION_MOCK=true', () => {
    const client = makeClient({
      NODE_ENV: 'development',
      EVOLUTION_MOCK: 'true',
    });
    expect(client.mockEnabled()).toBe(true);
    expect(client.configured()).toBe(true);
  });

  it('ignora o mock em produção mesmo com EVOLUTION_MOCK=1', async () => {
    const client = makeClient({
      NODE_ENV: 'production',
      EVOLUTION_MOCK: '1',
    });

    expect(client.mockEnabled()).toBe(false);
    expect(client.configured()).toBe(false);

    const result = await client.sendText({
      phone: '11999999999',
      text: 'não deve mockar',
    });

    expect(post).not.toHaveBeenCalled();
    expect(result).toEqual({ skipped: true, reason: 'not_configured' });
  });

  it('em produção com config real chama a Evolution e ignora o mock', async () => {
    post.mockResolvedValue({ data: { key: { id: 'msg-1' } } } as never);
    const client = makeClient({
      NODE_ENV: 'production',
      EVOLUTION_MOCK: '1',
      EVOLUTION_API_URL: 'https://evolution.example.com/',
      EVOLUTION_API_KEY: 'secret',
      EVOLUTION_INSTANCE: 'namao',
    });

    expect(client.mockEnabled()).toBe(false);
    expect(client.configured()).toBe(true);

    const result = await client.sendText({
      phone: '11999999999',
      text: 'oi',
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      'https://evolution.example.com/message/sendText/namao',
      { number: '11999999999', text: 'oi' },
      { headers: { apikey: 'secret' }, timeout: 15000 },
    );
    expect(result).toEqual({
      skipped: false,
      ok: true,
      data: { key: { id: 'msg-1' } },
    });
  });

  it('sem mock e sem config real fica not_configured', async () => {
    const client = makeClient({ NODE_ENV: 'development' });
    expect(client.configured()).toBe(false);
    await expect(
      client.sendText({ phone: '11999999999', text: 'oi' }),
    ).resolves.toEqual({ skipped: true, reason: 'not_configured' });
    expect(post).not.toHaveBeenCalled();
  });
});
