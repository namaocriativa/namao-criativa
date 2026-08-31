import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LeadProvider } from '../provider.interface';
import {
  DiscoveryQuery,
  DiscoveryResult,
  EnrichmentInput,
  ProviderResult,
} from '../provider.types';

const TEXT_SEARCH_URL =
  'https://maps.googleapis.com/maps/api/place/textsearch/json';
const MAX_PAGES = 3;
const NEXT_PAGE_DELAY_MS = 2000;

type PlacesTextSearchResponse = {
  status?: string;
  next_page_token?: string;
  results?: Array<{
    name?: string;
    formatted_address?: string;
    place_id?: string;
    rating?: number;
    user_ratings_total?: number;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
  }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class GoogleProvider implements LeadProvider {
  readonly name = 'google';
  private readonly logger = new Logger(GoogleProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string | undefined {
    const key = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    return key?.trim() || undefined;
  }

  async discover(query: DiscoveryQuery): Promise<DiscoveryResult[]> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      return [];
    }

    const textQuery = [
      query.category,
      query.neighborhood,
      query.city,
      query.state,
    ]
      .filter(Boolean)
      .join(' ');
    const limit = query.limit ?? 100;
    const results: DiscoveryResult[] = [];
    let pageToken: string | undefined;

    try {
      for (let page = 0; page < MAX_PAGES && results.length < limit; page += 1) {
        if (pageToken) {
          await sleep(NEXT_PAGE_DELAY_MS);
        }

        const data = await this.textSearch(apiKey, query, textQuery, pageToken);
        if (!data) {
          break;
        }

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
          this.logger.warn(`Google Places status: ${data.status}`);
          break;
        }

        for (const place of data.results ?? []) {
          results.push(this.mapPlace(place, query));
          if (results.length >= limit) break;
        }

        pageToken = data.next_page_token;
        if (!pageToken || data.status === 'ZERO_RESULTS') {
          break;
        }
      }

      return results;
    } catch (error) {
      this.logger.warn(
        `Google Places discovery failed: ${(error as Error).message}`,
      );
      return results;
    }
  }

  private async textSearch(
    apiKey: string,
    query: DiscoveryQuery,
    textQuery: string,
    pageToken?: string,
  ): Promise<PlacesTextSearchResponse | null> {
    const params: Record<string, string | number> = pageToken
      ? { pagetoken: pageToken, key: apiKey }
      : {
          query: textQuery,
          key: apiKey,
          language: 'pt-BR',
          region: 'br',
        };

    if (!pageToken && query.latitude != null && query.longitude != null) {
      params.location = `${query.latitude},${query.longitude}`;
      params.radius = Math.round((query.radiusKm ?? 5) * 1000);
    }

    const fetchPage = async () => {
      const { data } = await axios.get<PlacesTextSearchResponse>(
        TEXT_SEARCH_URL,
        { params, timeout: 12000 },
      );
      return data;
    };

    let data = await fetchPage();
    if (pageToken && data.status === 'INVALID_REQUEST') {
      await sleep(NEXT_PAGE_DELAY_MS);
      data = await fetchPage();
    }
    return data;
  }

  private mapPlace(
    place: NonNullable<PlacesTextSearchResponse['results']>[number],
    query: DiscoveryQuery,
  ): DiscoveryResult {
    return {
      name: place.name ?? 'Unknown',
      address: place.formatted_address ?? null,
      website: null,
      instagram: null,
      phone: null,
      rating: place.rating ?? null,
      reviewCount: place.user_ratings_total ?? null,
      category: place.types?.[0] ?? query.category ?? null,
      city: query.city,
      state: query.state,
      latitude: place.geometry?.location?.lat ?? null,
      longitude: place.geometry?.location?.lng ?? null,
      externalId: place.place_id ?? null,
      source: this.name,
      sources: [this.name],
    };
  }

  async enrich(input: EnrichmentInput): Promise<ProviderResult | null> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      return null;
    }

    const textQuery = [
      input.name,
      input.city,
      input.state,
      input.address,
    ]
      .filter(Boolean)
      .join(' ');

    try {
      const search = await axios.get(
        'https://maps.googleapis.com/maps/api/place/textsearch/json',
        {
          params: {
            query: textQuery,
            key: apiKey,
            language: 'pt-BR',
            region: 'br',
          },
          timeout: 12000,
        },
      );

      const place = search.data?.results?.[0];
      if (!place?.place_id) {
        return null;
      }

      const details = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        {
          params: {
            place_id: place.place_id,
            key: apiKey,
            language: 'pt-BR',
            fields:
              'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,geometry,types,url',
          },
          timeout: 12000,
        },
      );

      const result = details.data?.result;
      if (!result) {
        return null;
      }

      return {
        provider: this.name,
        externalId: place.place_id,
        sourceUrl: result.url ?? undefined,
        data: {
          name: result.name ?? input.name,
          address: result.formatted_address ?? null,
          phone:
            result.international_phone_number ??
            result.formatted_phone_number ??
            null,
          website: result.website ?? null,
          rating: result.rating ?? null,
          reviewCount: result.user_ratings_total ?? null,
          category: result.types?.[0] ?? null,
          latitude: result.geometry?.location?.lat ?? null,
          longitude: result.geometry?.location?.lng ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          country: 'BR',
        },
        raw: result,
      };
    } catch (error) {
      this.logger.warn(
        `Google Places enrich failed: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
