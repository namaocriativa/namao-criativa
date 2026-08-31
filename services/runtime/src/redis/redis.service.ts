import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private available = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      this.logger.warn('REDIS_URL not set; chat rate limit uses memory');
      return;
    }

    const redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: () => null,
    });

    redis.on('error', (err) => {
      this.available = false;
      this.logger.warn(`Redis error: ${err.message}`);
    });

    redis.on('ready', () => {
      this.available = true;
      this.logger.log('Redis connected');
    });

    try {
      await redis.connect();
      this.client = redis;
      this.available = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis unavailable; rate limit uses memory: ${message}`);
      redis.disconnect();
      this.client = null;
      this.available = false;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
      this.available = false;
    }
  }

  isAvailable(): boolean {
    return this.available && this.client !== null;
  }

  async incrWithTtl(key: string, ttlSec: number): Promise<number | null> {
    if (!this.isAvailable() || !this.client) return null;
    try {
      const count = await this.client.incr(key);
      if (count === 1) await this.client.expire(key, ttlSec);
      return count;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis INCR failed: ${message}`);
      this.available = false;
      return null;
    }
  }
}
