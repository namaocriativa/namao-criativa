import { InviteRateLimitService } from './invite-rate-limit.service';

describe('InviteRateLimitService', () => {
  it('estoura o limite de IP na memória quando Redis está down', async () => {
    const redis = {
      incrWithTtl: jest.fn().mockResolvedValue(null),
    };
    const limiter = new InviteRateLimitService(redis as never);
    let blocked = false;
    for (let i = 0; i < 6; i += 1) {
      blocked = await limiter.tooMany('1.1.1.1');
    }
    expect(blocked).toBe(true);
  });
});
