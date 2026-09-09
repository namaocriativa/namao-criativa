import { ChatRateLimitService } from './rate-limit.service';

describe('ChatRateLimitService', () => {
  it('estoura o limite de IP na memória quando Redis está down', async () => {
    const redis = {
      incrWithTtl: jest.fn().mockResolvedValue(null),
    };
    const limiter = new ChatRateLimitService(redis as never);
    let blocked = false;
    for (let i = 0; i < 21; i += 1) {
      blocked = await limiter.tooMany('ip', 'abc');
    }
    expect(blocked).toBe(true);
  });

  it('estoura sessão e site pelos tetos configurados', async () => {
    const redis = {
      incrWithTtl: jest.fn().mockResolvedValue(null),
    };
    const limiter = new ChatRateLimitService(redis as never);
    let sess = false;
    for (let i = 0; i < 9; i += 1) sess = await limiter.tooMany('sess', 's1');
    let site = false;
    for (let i = 0; i < 61; i += 1) site = await limiter.tooMany('site', 'site1');
    expect(sess).toBe(true);
    expect(site).toBe(true);
  });
});
