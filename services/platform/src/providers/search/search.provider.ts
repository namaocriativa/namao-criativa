import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  bboxFromCenterRadius,
  bboxFromNominatimBox,
  parseBbox,
} from '../../lead-discovery/discovery-geo';
import { LeadProvider } from '../provider.interface';
import {
  DiscoveryQuery,
  DiscoveryResult,
  EnrichmentInput,
  ProviderResult,
} from '../provider.types';

interface NominatimResult {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
  osm_id?: number;
  osm_type?: string;
  boundingbox?: [string, string, string, string];
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    road?: string;
    suburb?: string;
    country?: string;
    country_code?: string;
  };
  extratags?: {
    website?: string;
    phone?: string;
    email?: string;
    'contact:website'?: string;
    'contact:phone'?: string;
    'contact:email'?: string;
    'contact:instagram'?: string;
  };
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const NOMINATIM_UA =
  'discovery-lead-enrichment/1.0 (local-dev; contact@localhost)';

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const ADMIN_TYPES = new Set([
  'administrative',
  'boundary',
  'city',
  'town',
  'village',
  'municipality',
  'state',
  'county',
  'region',
  'suburb',
  'neighbourhood',
  'quarter',
]);

@Injectable()
export class SearchProvider implements LeadProvider {
  readonly name = 'search';
  private readonly logger = new Logger(SearchProvider.name);

  private static readonly DISCOVERY_LIMIT_DEFAULT = 100;

  async discover(query: DiscoveryQuery): Promise<DiscoveryResult[]> {
    const limit = query.limit ?? SearchProvider.DISCOVERY_LIMIT_DEFAULT;
    const bbox = await this.resolveDiscoveryBBox(query);
    if (!bbox) {
      this.logger.warn(
        `Could not resolve bbox for ${query.city}/${query.state}`,
      );
      return [];
    }

    const category = query.category?.trim() || undefined;

    try {
      const elements = await this.queryOverpass(
        this.buildBusinessQuery(bbox, category),
      );
      const results = this.mapOverpassElements(elements, {
        ...query,
        category,
      })
        .filter((item) => this.isBusinessLead(item, query.city))
        .slice(0, limit);

      if (results.length) {
        this.logger.log(
          `OSM discovery: ${results.length} businesses in ${query.city}/${query.state}${category ? ` (${category})` : ''}`,
        );
        return results;
      }
    } catch (error) {
      this.logger.warn(
        `Overpass discovery failed: ${(error as Error).message}`,
      );
    }

    return this.discoverViaNominatim(query);
  }

  async enrich(input: EnrichmentInput): Promise<ProviderResult | null> {
    const q = [input.name, input.city, input.state, 'Brasil']
      .filter(Boolean)
      .join(' ');

    try {
      const { data } = await axios.get<NominatimResult[]>(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            q,
            format: 'json',
            addressdetails: 1,
            extratags: 1,
            limit: 5,
            countrycodes: 'br',
          },
          timeout: 15000,
          headers: {
            'User-Agent': NOMINATIM_UA,
            Accept: 'application/json',
          },
        },
      );

      const match = (data ?? []).find((item) => {
        if (this.isAdministrative(item)) return false;
        const name = (item.name || item.display_name || '').toLowerCase();
        return name.includes(input.name.toLowerCase().split(' ')[0]);
      });

      if (!match) {
        return null;
      }

      const website =
        match.extratags?.website ??
        match.extratags?.['contact:website'] ??
        null;
      const phone =
        match.extratags?.phone ?? match.extratags?.['contact:phone'] ?? null;
      const email =
        match.extratags?.email ?? match.extratags?.['contact:email'] ?? null;
      const instagram = match.extratags?.['contact:instagram'] ?? null;

      const city =
        match.address?.city ??
        match.address?.town ??
        match.address?.village ??
        match.address?.municipality ??
        input.city ??
        null;

      return {
        provider: this.name,
        externalId:
          match.osm_type && match.osm_id
            ? `${match.osm_type}/${match.osm_id}`
            : undefined,
        sourceUrl: `https://www.openstreetmap.org/${match.osm_type}/${match.osm_id}`,
        data: {
          name: match.name || input.name,
          address: match.display_name ?? input.address ?? null,
          website,
          phone,
          email,
          instagram,
          city,
          state: match.address?.state ?? input.state ?? null,
          country: match.address?.country_code?.toUpperCase() ?? 'BR',
          latitude: match.lat ? Number(match.lat) : null,
          longitude: match.lon ? Number(match.lon) : null,
        },
        raw: match,
      };
    } catch (error) {
      this.logger.warn(
        `Nominatim enrich failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async discoverViaNominatim(
    query: DiscoveryQuery,
  ): Promise<DiscoveryResult[]> {
    const limit = Math.min(
      query.limit ?? SearchProvider.DISCOVERY_LIMIT_DEFAULT,
      50,
    );
    const q = [query.category, query.city, query.state, 'Brasil']
      .filter(Boolean)
      .join(' ');

    try {
      const { data } = await axios.get<NominatimResult[]>(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            q,
            format: 'json',
            addressdetails: 1,
            extratags: 1,
            limit,
            countrycodes: 'br',
            ...this.nominatimViewboxParams(query.bbox),
          },
          timeout: 15000,
          headers: {
            'User-Agent': NOMINATIM_UA,
            Accept: 'application/json',
          },
        },
      );

      return (data ?? [])
        .filter((item) => item.display_name || item.name)
        .filter((item) => !this.isAdministrative(item))
        .map((item) => {
          const city =
            item.address?.city ??
            item.address?.town ??
            item.address?.village ??
            item.address?.municipality;
          const road = item.address?.road;
          const addressParts = [road, city, item.address?.state].filter(
            Boolean,
          );

          return {
            name: item.name || item.display_name?.split(',')[0] || 'Unknown',
            address:
              addressParts.length > 0
                ? addressParts.join(' - ')
                : (item.display_name ?? null),
            website:
              item.extratags?.website ??
              item.extratags?.['contact:website'] ??
              null,
            instagram: item.extratags?.['contact:instagram'] ?? null,
            phone:
              item.extratags?.phone ??
              item.extratags?.['contact:phone'] ??
              null,
            rating: null,
            reviewCount: null,
            category: query.category ?? item.type ?? item.class ?? null,
            city: city ?? query.city,
            state: item.address?.state ?? query.state,
            latitude: item.lat ? Number(item.lat) : null,
            longitude: item.lon ? Number(item.lon) : null,
            externalId:
              item.osm_type && item.osm_id
                ? `${item.osm_type}/${item.osm_id}`
                : null,
            source: this.name,
            sources: [this.name],
          } satisfies DiscoveryResult;
        })
        .filter((item) => this.isBusinessLead(item, query.city));
    } catch (error) {
      this.logger.warn(
        `Nominatim discovery failed: ${(error as Error).message}`,
      );
      return [];
    }
  }

  private async resolveDiscoveryBBox(
    query: DiscoveryQuery,
  ): Promise<string | null> {
    if (query.bbox) {
      return query.bbox;
    }
    if (query.latitude != null && query.longitude != null) {
      return bboxFromCenterRadius(
        query.latitude,
        query.longitude,
        query.radiusKm ?? 5,
      );
    }
    return this.resolveCityBBox(query.city, query.state);
  }

  private nominatimViewboxParams(
    bbox?: string,
  ): Record<string, string | number> {
    if (!bbox) return {};
    const parsed = parseBbox(bbox);
    if (!parsed) return {};
    return {
      viewbox: `${parsed.west},${parsed.north},${parsed.east},${parsed.south}`,
      bounded: 1,
    };
  }

  private async resolveCityBBox(
    city: string,
    state: string,
  ): Promise<string | null> {
    try {
      const { data } = await axios.get<NominatimResult[]>(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            city,
            state,
            country: 'Brasil',
            format: 'json',
            limit: 1,
            countrycodes: 'br',
          },
          timeout: 15000,
          headers: {
            'User-Agent': NOMINATIM_UA,
            Accept: 'application/json',
          },
        },
      );

      const hit = data?.[0];
      const box = hit?.boundingbox;
      if (!box || box.length !== 4) {
        return null;
      }

      return bboxFromNominatimBox(box);
    } catch (error) {
      this.logger.warn(
        `Nominatim geocode failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private buildBusinessQuery(bbox: string, category?: string): string {
    const clauses = this.categoryClauses(bbox, category);
    return `[out:json][timeout:60];
(
${clauses.join('\n')}
);
out center;`;
  }

  private categoryClauses(bbox: string, category?: string): string[] {
    const normalized = this.normalize(category ?? '');

    if (!normalized) {
      return [
        `nwr(${bbox})["shop"]["name"];`,
        `nwr(${bbox})["office"]["name"];`,
        `nwr(${bbox})["craft"]["name"];`,
        `nwr(${bbox})["healthcare"]["name"];`,
        `nwr(${bbox})["tourism"]["name"];`,
        `nwr(${bbox})["leisure"~"fitness_centre|sports_centre|bowling_alley|escape_game|hackerspace|amusement_arcade"]["name"];`,
        `nwr(${bbox})["amenity"]["name"]["amenity"!~"^(parking|parking_space|bench|toilets|waste_basket|recycling|drinking_water|fountain|bicycle_parking|shelter|hunting_stand|bbq|grit_bin|vending_machine|clock|post_box)$"];`,
      ];
    }

    if (
      normalized.includes('advogad') ||
      normalized.includes('lawyer') ||
      normalized.includes('jurid')
    ) {
      return [
        `nwr(${bbox})["office"="lawyer"]["name"];`,
        `nwr(${bbox})["amenity"="lawyer"]["name"];`,
        `nwr(${bbox})["name"~"[Aa]dvogad|[Jj]ur[ií]dic|[Dd]ireito"];`,
      ];
    }

    if (
      normalized.includes('restaurant') ||
      normalized.includes('comida') ||
      normalized.includes('aliment')
    ) {
      return [
        `nwr(${bbox})["amenity"~"restaurant|cafe|fast_food|bar"]["name"];`,
      ];
    }

    if (normalized.includes('farmac') || normalized.includes('pharmacy')) {
      return [`nwr(${bbox})["amenity"="pharmacy"]["name"];`];
    }

    if (
      normalized.includes('hotel') ||
      normalized.includes('pousada') ||
      normalized.includes('hosped')
    ) {
      return [
        `nwr(${bbox})["tourism"~"hotel|motel|guest_house"]["name"];`,
      ];
    }

    if (
      normalized.includes('loja') ||
      normalized.includes('comercio') ||
      normalized.includes('shop')
    ) {
      return [`nwr(${bbox})["shop"]["name"];`];
    }

    if (
      normalized.includes('clinic') ||
      normalized.includes('saude') ||
      normalized.includes('health') ||
      normalized.includes('medico') ||
      normalized.includes('hospital')
    ) {
      return [
        `nwr(${bbox})["healthcare"]["name"];`,
        `nwr(${bbox})["amenity"~"clinic|doctors|hospital"]["name"];`,
      ];
    }

    if (normalized.includes('dent')) {
      return [
        `nwr(${bbox})["healthcare"="dentist"]["name"];`,
        `nwr(${bbox})["amenity"="dentist"]["name"];`,
        `nwr(${bbox})["name"~"[Dd]entist|[Oo]donto"];`,
      ];
    }

    if (
      normalized.includes('contab') ||
      normalized.includes('contador') ||
      normalized.includes('accountant')
    ) {
      return [
        `nwr(${bbox})["office"="accountant"]["name"];`,
        `nwr(${bbox})["name"~"[Cc]ontab|[Cc]ontador"];`,
      ];
    }

    if (
      normalized.includes('imobil') ||
      normalized.includes('real_estate') ||
      normalized.includes('corretor')
    ) {
      return [
        `nwr(${bbox})["office"="estate_agent"]["name"];`,
        `nwr(${bbox})["name"~"[Ii]mobil|[Cc]orretor"];`,
      ];
    }

    if (
      normalized.includes('academia') ||
      normalized.includes('fitness') ||
      normalized.includes('gym')
    ) {
      return [
        `nwr(${bbox})["leisure"~"fitness_centre|sports_centre"]["name"];`,
        `nwr(${bbox})["amenity"="gym"]["name"];`,
      ];
    }

    if (
      normalized.includes('beleza') ||
      normalized.includes('salao') ||
      normalized.includes('cabeleir') ||
      normalized.includes('beauty') ||
      normalized.includes('barbear')
    ) {
      return [
        `nwr(${bbox})["shop"~"beauty|hairdresser"]["name"];`,
        `nwr(${bbox})["craft"="hairdresser"]["name"];`,
      ];
    }

    if (
      normalized.includes('pet') ||
      normalized.includes('veterin') ||
      normalized.includes('animal')
    ) {
      return [
        `nwr(${bbox})["shop"="pet"]["name"];`,
        `nwr(${bbox})["amenity"="veterinary"]["name"];`,
      ];
    }

    if (
      normalized.includes('oficina') ||
      normalized.includes('mecan') ||
      normalized.includes('auto')
    ) {
      return [
        `nwr(${bbox})["shop"="car_repair"]["name"];`,
        `nwr(${bbox})["craft"="car_repair"]["name"];`,
      ];
    }

    if (
      normalized.includes('escola') ||
      normalized.includes('colegio') ||
      normalized.includes('educ') ||
      normalized.includes('school')
    ) {
      return [
        `nwr(${bbox})["amenity"~"school|college|university|kindergarten"]["name"];`,
      ];
    }

    // Generic: match category text in name + common business tags.
    const escaped = category!
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [
      `nwr(${bbox})["name"~"${escaped}",i];`,
      `nwr(${bbox})["shop"]["name"~"${escaped}",i];`,
      `nwr(${bbox})["office"]["name"~"${escaped}",i];`,
      `nwr(${bbox})["craft"]["name"~"${escaped}",i];`,
      `nwr(${bbox})["amenity"]["name"~"${escaped}",i];`,
    ];
  }

  private async queryOverpass(query: string): Promise<OverpassElement[]> {
    let lastError: Error | null = null;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const { data } = await axios.post<{ elements?: OverpassElement[] }>(
          endpoint,
          new URLSearchParams({ data: query }).toString(),
          {
            timeout: 65000,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': NOMINATIM_UA,
              Accept: 'application/json',
            },
            responseType: 'json',
            validateStatus: (status) => status >= 200 && status < 300,
          },
        );

        if (Array.isArray(data?.elements)) {
          return data.elements;
        }
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Overpass endpoint failed (${endpoint}): ${lastError.message}`,
        );
      }
    }

    throw lastError ?? new Error('Overpass unavailable');
  }

  private mapOverpassElements(
    elements: OverpassElement[],
    query: DiscoveryQuery,
  ): DiscoveryResult[] {
    const seen = new Set<string>();
    const results: DiscoveryResult[] = [];

    for (const el of elements) {
      const tags = el.tags ?? {};
      const name = tags.name?.trim();
      if (!name) continue;

      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const lat = el.lat ?? el.center?.lat ?? null;
      const lon = el.lon ?? el.center?.lon ?? null;
      const road = tags['addr:street'];
      const number = tags['addr:housenumber'];
      const suburb = tags['addr:suburb'] ?? tags['addr:neighbourhood'];
      const addressParts = [
        [road, number].filter(Boolean).join(', '),
        suburb,
        query.city,
        query.state,
      ].filter(Boolean);

      const category =
        query.category ??
        tags.office ??
        tags.shop ??
        tags.amenity ??
        tags.craft ??
        tags.tourism ??
        null;

      results.push({
        name,
        address: addressParts.length ? addressParts.join(' - ') : null,
        website: tags.website ?? tags['contact:website'] ?? null,
        instagram: tags['contact:instagram'] ?? tags.instagram ?? null,
        phone:
          tags.phone ??
          tags['contact:phone'] ??
          tags['contact:mobile'] ??
          null,
        rating: null,
        reviewCount: null,
        category,
        city: query.city,
        state: query.state,
        latitude: lat,
        longitude: lon,
        externalId: `${el.type}/${el.id}`,
        source: this.name,
        sources: [this.name],
      });
    }

    return results;
  }

  private isAdministrative(item: NominatimResult): boolean {
    if (item.class === 'boundary' || item.class === 'place') {
      if (!item.type || ADMIN_TYPES.has(item.type) || item.type === 'yes') {
        return true;
      }
    }
    if (item.type && ADMIN_TYPES.has(item.type)) {
      return true;
    }
    return false;
  }

  private isBusinessLead(item: DiscoveryResult, city: string): boolean {
    const name = this.normalize(item.name);
    const cityName = this.normalize(city);
    if (!name) return false;
    // Reject pure city/municipality hits (e.g. "Cidade" / "Cidade - Estado")
    if (name === cityName) return false;
    if (name.startsWith(`${cityName} -`)) return false;
    return true;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
