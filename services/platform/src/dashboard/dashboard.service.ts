import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import type { JwtUser } from '../auth/jwt.strategy';
import { jwtOwnerId } from '../owner/owner.util';
import { OwnerLookup } from '../owner/owner-lookup.service';
import type { AnalyticsRange } from './dto/analytics-query.dto';
import { Ga4Client } from './ga4.client';
import { hostnameFromOrigin } from './hostname';

const CACHE_TTL_SEC = 15 * 60;
const CACHE_PREFIX = 'dashboard:analytics:';

const DATE_RANGES: Record<AnalyticsRange, { startDate: string; endDate: string }> =
  {
    '7d': { startDate: '7daysAgo', endDate: 'today' },
    '28d': { startDate: '28daysAgo', endDate: 'today' },
    '90d': { startDate: '90daysAgo', endDate: 'today' },
  };

export type AnalyticsKpis = {
  users: number;
  sessions: number;
  pageviews: number;
  engagementRate: number;
};

export type AnalyticsOk = {
  status: 'ok' | 'empty';
  hostname: string;
  range: AnalyticsRange;
  kpis: AnalyticsKpis;
  topPages: Array<{ path: string; views: number }>;
  channels: Array<{ name: string; sessions: number }>;
};

export type AnalyticsResponse =
  | AnalyticsOk
  | { status: 'unpublished' }
  | { status: 'unconfigured' }
  | { status: 'error'; message: string };

type MemoryEntry = { value: AnalyticsResponse; expiresAt: number };

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly memory = new Map<string, MemoryEntry>();

  constructor(
    private readonly owners: OwnerLookup,
    private readonly redis: RedisService,
    private readonly ga4: Ga4Client,
  ) {}

  async analytics(
    user: JwtUser,
    range: AnalyticsRange = '7d',
  ): Promise<AnalyticsResponse> {
    const ownerId = jwtOwnerId(user);
    if (!ownerId) return { status: 'unpublished' };

    const profile = await this.owners.findProfile(ownerId);
    const hostname = hostnameFromOrigin(profile?.publishedOrigin);
    if (!hostname) return { status: 'unpublished' };
    if (!this.ga4.configured()) return { status: 'unconfigured' };

    const cacheKey = `${CACHE_PREFIX}${ownerId}:${range}`;
    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    try {
      const payload = await this.fetchReport(hostname, range);
      await this.writeCache(cacheKey, payload);
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`GA4 report failed: ${message}`);
      return { status: 'error', message: 'Não foi possível ler o Analytics agora.' };
    }
  }

  private async fetchReport(
    hostname: string,
    range: AnalyticsRange,
  ): Promise<AnalyticsOk> {
    const dateRange = DATE_RANGES[range];
    const [kpisRows, pagesRows, channelRows] = await Promise.all([
      this.ga4.runReport({
        hostname,
        dateRange,
        dimensions: [],
        metrics: [
          'activeUsers',
          'sessions',
          'screenPageViews',
          'engagementRate',
        ],
      }),
      this.ga4.runReport({
        hostname,
        dateRange,
        dimensions: ['pagePath'],
        metrics: ['screenPageViews'],
        limit: 8,
      }),
      this.ga4.runReport({
        hostname,
        dateRange,
        dimensions: ['sessionDefaultChannelGroup'],
        metrics: ['sessions'],
        limit: 6,
      }),
    ]);

    const kpisRaw = kpisRows[0]?.metricValues || [0, 0, 0, 0];
    const kpis: AnalyticsKpis = {
      users: Math.round(kpisRaw[0] || 0),
      sessions: Math.round(kpisRaw[1] || 0),
      pageviews: Math.round(kpisRaw[2] || 0),
      engagementRate: Number(kpisRaw[3] || 0),
    };
    const topPages = pagesRows
      .map((row) => ({
        path: row.dimensionValues[0] || '/',
        views: Math.round(row.metricValues[0] || 0),
      }))
      .filter((row) => row.path);
    const channels = channelRows
      .map((row) => ({
        name: row.dimensionValues[0] || 'Direct',
        sessions: Math.round(row.metricValues[0] || 0),
      }))
      .filter((row) => row.name);

    const empty =
      kpis.users === 0 && kpis.sessions === 0 && kpis.pageviews === 0;
    return {
      status: empty ? 'empty' : 'ok',
      hostname,
      range,
      kpis,
      topPages,
      channels,
    };
  }

  private async readCache(key: string): Promise<AnalyticsResponse | null> {
    const fromRedis = await this.redis.get(key);
    if (fromRedis) {
      try {
        return JSON.parse(fromRedis) as AnalyticsResponse;
      } catch {
        return null;
      }
    }
    const mem = this.memory.get(key);
    if (!mem) return null;
    if (mem.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return mem.value;
  }

  private async writeCache(key: string, value: AnalyticsResponse) {
    const encoded = JSON.stringify(value);
    const stored = await this.redis.setex(key, CACHE_TTL_SEC, encoded);
    if (!stored) {
      this.memory.set(key, {
        value,
        expiresAt: Date.now() + CACHE_TTL_SEC * 1000,
      });
    }
  }
}
