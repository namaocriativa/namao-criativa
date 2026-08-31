import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleProvider } from '../providers/google/google.provider';
import { SearchProvider } from '../providers/search/search.provider';
import { DiscoveryQuery, DiscoveryResult } from '../providers/provider.types';
import { RedisService } from '../redis/redis.service';
import { DiscoveryGeo, LocationsService } from '../locations/locations.service';
import {
  DISCOVERY_LIMIT_DEFAULT,
  DISCOVERY_RADIUS_DEFAULT,
  LeadDiscoveryDto,
} from './dto/lead-discovery.dto';
import { mergeDiscoveryResults } from './discovery-merge';

const DISCOVERY_CACHE_PREFIX = 'discovery:';

export type DiscoveryGeoInfo = {
  mode: 'neighborhood' | 'radius';
  fallback?: boolean;
  neighborhood?: string;
  radiusKm: number;
};

type CachedPayload = {
  results: DiscoveryResult[];
  geo?: DiscoveryGeoInfo;
};

@Injectable()
export class LeadDiscoveryService {
  private readonly logger = new Logger(LeadDiscoveryService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly googleProvider: GoogleProvider,
    private readonly searchProvider: SearchProvider,
    private readonly locations: LocationsService,
    private readonly redis: RedisService,
  ) {}

  async discover(dto: LeadDiscoveryDto): Promise<{
    results: DiscoveryResult[];
    cached: boolean;
    geo?: DiscoveryGeoInfo;
  }> {
    const query: DiscoveryQuery = {
      city: dto.city.trim(),
      state: dto.state.trim(),
      category: dto.category?.trim() || undefined,
      neighborhood: dto.neighborhood?.trim() || undefined,
      radiusKm: dto.radiusKm ?? DISCOVERY_RADIUS_DEFAULT,
      limit: dto.limit ?? DISCOVERY_LIMIT_DEFAULT,
    };

    const cacheKey = this.cacheKey(query);
    const cached = await this.readCache(cacheKey);
    if (cached) {
      this.logger.log(`Discovery cache hit: ${cacheKey}`);
      return { results: cached.results, cached: true, geo: cached.geo };
    }

    const geo = await this.locations.resolveDiscoveryGeo({
      city: query.city,
      state: query.state,
      neighborhood: query.neighborhood,
      radiusKm: query.radiusKm,
    });

    if (!geo) {
      this.logger.warn(
        `Could not resolve discovery geo for ${query.city}/${query.state}`,
      );
      return {
        results: [],
        cached: false,
        geo: {
          mode: 'radius',
          fallback: Boolean(query.neighborhood),
          neighborhood: query.neighborhood,
          radiusKm: query.radiusKm ?? DISCOVERY_RADIUS_DEFAULT,
        },
      };
    }

    const geoQuery: DiscoveryQuery = {
      ...query,
      latitude: geo.latitude,
      longitude: geo.longitude,
      bbox: geo.bbox,
      radiusKm: geo.radiusKm,
      neighborhood: geo.neighborhood ?? query.neighborhood,
    };
    const geoInfo = this.toGeoInfo(geo);

    const apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY')?.trim();
    const tasks: Array<Promise<DiscoveryResult[]>> = [];

    if (apiKey) {
      this.logger.log('Using Google Places + OSM for discovery');
      tasks.push(this.googleProvider.discover(geoQuery));
    } else {
      this.logger.log('Using OpenStreetMap Overpass for discovery');
    }
    tasks.push(this.searchProvider.discover(geoQuery));

    const settled = await Promise.allSettled(tasks);
    const googleResults =
      apiKey && settled[0]?.status === 'fulfilled' ? settled[0].value : [];
    const osmSlot = apiKey ? settled[1] : settled[0];
    const osmResults =
      osmSlot?.status === 'fulfilled' ? osmSlot.value : [];

    if (apiKey && settled[0]?.status === 'rejected') {
      this.logger.warn(
        `Google discovery rejected: ${(settled[0].reason as Error)?.message}`,
      );
    }
    if (osmSlot?.status === 'rejected') {
      this.logger.warn(
        `OSM discovery rejected: ${(osmSlot.reason as Error)?.message}`,
      );
    }

    const merged = mergeDiscoveryResults(googleResults, osmResults, {
      city: query.city,
      state: query.state,
    });
    const results = merged.slice(0, query.limit);
    await this.writeCache(cacheKey, { results, geo: geoInfo });

    return { results, cached: false, geo: geoInfo };
  }

  async clearCache(): Promise<{ ok: true; cleared: number }> {
    const cleared = await this.redis.delByPrefix(DISCOVERY_CACHE_PREFIX);
    this.logger.log(`Discovery cache cleared: ${cleared} key(s)`);
    return { ok: true, cleared };
  }

  private toGeoInfo(geo: DiscoveryGeo): DiscoveryGeoInfo {
    return {
      mode: geo.mode,
      fallback: geo.fallback || undefined,
      neighborhood: geo.neighborhood,
      radiusKm: geo.radiusKm,
    };
  }

  private cacheKey(query: DiscoveryQuery): string {
    const city = query.city.toLowerCase();
    const state = query.state.toLowerCase();
    const category = (query.category || '__').toLowerCase();
    const neighborhood = (query.neighborhood || '__').toLowerCase();
    const radius = query.radiusKm ?? DISCOVERY_RADIUS_DEFAULT;
    return `${DISCOVERY_CACHE_PREFIX}${city}:${state}:${category}:${query.limit}:${neighborhood}:${radius}`;
  }

  private async readCache(key: string): Promise<CachedPayload | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as CachedPayload | DiscoveryResult[];
      if (Array.isArray(parsed)) {
        return { results: parsed };
      }
      if (parsed && Array.isArray(parsed.results)) {
        return parsed;
      }
      return null;
    } catch {
      this.logger.warn(`Invalid discovery cache payload for ${key}`);
      return null;
    }
  }

  private async writeCache(
    key: string,
    payload: CachedPayload,
  ): Promise<void> {
    await this.redis.set(key, JSON.stringify(payload));
  }
}
