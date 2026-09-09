import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

type Bucket = 'ip' | 'sess' | 'site';

const LIMITS: Record<Bucket, { max: number; windowSec: number; prefix: string }> =
  {
    ip: { max: 20, windowSec: 60, prefix: 'chat:ip:' },
    sess: { max: 8, windowSec: 60, prefix: 'chat:sess:' },
    site: { max: 60, windowSec: 60, prefix: 'chat:site:' },
  };

type MemoryHit = { count: number; resetAt: number };

@Injectable()
export class ChatRateLimitService {
  private readonly memory = new Map<string, MemoryHit>();

  constructor(private readonly redis: RedisService) {}

  async tooMany(bucket: Bucket, id: string): Promise<boolean> {
    const spec = LIMITS[bucket];
    const key = `${spec.prefix}${id}`;
    const count = await this.incr(key, spec.windowSec);
    return count > spec.max;
  }

  private async incr(key: string, ttlSec: number): Promise<number> {
    const fromRedis = await this.redis.incrWithTtl(key, ttlSec);
    if (fromRedis != null) return fromRedis;
    return this.incrMemory(key, ttlSec);
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
