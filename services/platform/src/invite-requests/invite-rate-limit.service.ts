import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const MAX = 5;
const WINDOW_SEC = 15 * 60;
const PREFIX = 'invite:ip:';

type MemoryHit = { count: number; resetAt: number };

@Injectable()
export class InviteRateLimitService {
  private readonly memory = new Map<string, MemoryHit>();

  constructor(private readonly redis: RedisService) {}

  async tooMany(ip: string): Promise<boolean> {
    const key = `${PREFIX}${ip || '0.0.0.0'}`;
    const fromRedis = await this.redis.incrWithTtl(key, WINDOW_SEC);
    const count = fromRedis ?? this.incrMemory(key, WINDOW_SEC);
    return count > MAX;
  }

  private incrMemory(key: string, ttlSec: number): number {
    const now = Date.now();
    const current = this.memory.get(key);
    if (!current || current.resetAt <= now) {
      const next = { count: 1, resetAt: now + ttlSec * 1000 };
      this.memory.set(key, next);
      this.prune(now);
      return 1;
    }
    current.count += 1;
    return current.count;
  }

  private prune(now: number) {
    if (this.memory.size < 2000) return;
    for (const [key, value] of this.memory) {
      if (value.resetAt <= now) this.memory.delete(key);
    }
  }
}
