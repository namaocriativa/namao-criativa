import { AuthRateLimitService } from './auth-rate-limit.service';

describe('AuthRateLimitService', () => {
  const redis = { incrWithTtl: jest.fn().mockResolvedValue(null) };
  const service = new AuthRateLimitService(redis as never);

  it('bloqueia após 10 tentativas', async () => {
    let blocked = false;
    for (let i = 0; i < 11; i += 1) {
      blocked = await service.tooMany('1.1.1.1');
    }
    expect(blocked).toBe(true);
  });
});
