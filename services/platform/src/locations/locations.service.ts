import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import {
  bboxCenter,
  bboxFromCenterRadius,
  bboxFromNominatimBox,
  radiusKmFromBbox,
} from '../lead-discovery/discovery-geo';
import {
  DISCOVERY_RADIUS_DEFAULT,
  DISCOVERY_RADIUS_MAX,
} from '../lead-discovery/dto/lead-discovery.dto';

export interface CitySuggestion {
  id: number;
  name: string;
  state: string;
  label: string;
}

export interface NeighborhoodSuggestion {
  name: string;
  city: string;
  state: string;
  label: string;
  latitude: number;
  longitude: number;
  bbox: string;
}

export type DiscoveryGeo = {
  bbox: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  mode: 'neighborhood' | 'radius';
  fallback: boolean;
  neighborhood?: string;
};

interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string;
      };
    };
  };
}

interface NominatimResult {
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
  boundingbox?: [string, string, string, string];
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    state?: string;
  };
}

const NOMINATIM_UA =
  'discovery-lead-enrichment/1.0 (local-dev; contact@localhost)';

const NEIGHBORHOOD_TYPES = new Set([
  'suburb',
  'neighbourhood',
  'neighborhood',
  'quarter',
  'city_district',
  'district',
  'residential',
]);

@Injectable()
export class LocationsService implements OnModuleInit {
  private readonly logger = new Logger(LocationsService.name);
  private cities: CitySuggestion[] = [];
  private loadPromise: Promise<void> | null = null;

  onModuleInit() {
    void this.ensureLoaded();
  }

  async searchCities(query: string, limit = 10): Promise<CitySuggestion[]> {
    await this.ensureLoaded();
    const q = this.normalize(query);
    if (q.length < 2) {
      return [];
    }

    const capped = Math.min(Math.max(limit, 1), 25);
    const startsWith: CitySuggestion[] = [];
    const wordStartsWith: CitySuggestion[] = [];

    for (const city of this.cities) {
      const name = this.normalize(city.name);
      if (name.startsWith(q)) {
        startsWith.push(city);
      } else if (name.split(/\s+/).some((part) => part.startsWith(q))) {
        wordStartsWith.push(city);
      }
      if (startsWith.length >= capped) {
        break;
      }
    }

    return [...startsWith, ...wordStartsWith].slice(0, capped);
  }

  async searchNeighborhoods(
    city: string,
    state: string,
    query: string,
    limit = 8,
  ): Promise<NeighborhoodSuggestion[]> {
    const cityName = city.trim();
    const uf = state.trim();
    const q = query.trim();
    if (!cityName || !uf || q.length < 2) {
      return [];
    }

    const hits = await this.nominatimSearch({
      q: `${q}, ${cityName}, ${uf}, Brasil`,
      limit: Math.min(Math.max(limit, 1), 15),
    });

    const seen = new Set<string>();
    const results: NeighborhoodSuggestion[] = [];

    for (const hit of hits) {
      if (!this.isNeighborhoodHit(hit, q)) continue;
      const mapped = this.mapNeighborhood(hit, cityName, uf);
      if (!mapped) continue;
      const key = this.normalize(mapped.name);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(mapped);
      if (results.length >= Math.min(Math.max(limit, 1), 10)) break;
    }

    return results;
  }

  async resolveDiscoveryGeo(opts: {
    city: string;
    state: string;
    neighborhood?: string;
    radiusKm?: number;
  }): Promise<DiscoveryGeo | null> {
    const radiusKm = opts.radiusKm ?? DISCOVERY_RADIUS_DEFAULT;
    const neighborhood = opts.neighborhood?.trim();

    if (neighborhood) {
      const matches = await this.searchNeighborhoods(
        opts.city,
        opts.state,
        neighborhood,
        5,
      );
      const exact = matches.find(
        (item) => this.normalize(item.name) === this.normalize(neighborhood),
      );
      const hit = exact ?? matches[0];
      if (hit) {
        const center = bboxCenter(hit.bbox);
        const latitude = center?.latitude ?? hit.latitude;
        const longitude = center?.longitude ?? hit.longitude;
        return {
          bbox: hit.bbox,
          latitude,
          longitude,
          radiusKm: Math.min(DISCOVERY_RADIUS_MAX, radiusKmFromBbox(hit.bbox)),
          mode: 'neighborhood',
          fallback: false,
          neighborhood: hit.name,
        };
      }
    }

    const cityGeo = await this.geocodeCity(opts.city, opts.state);
    if (!cityGeo) {
      return null;
    }

    return {
      bbox: bboxFromCenterRadius(cityGeo.latitude, cityGeo.longitude, radiusKm),
      latitude: cityGeo.latitude,
      longitude: cityGeo.longitude,
      radiusKm,
      mode: 'radius',
      fallback: Boolean(neighborhood),
      neighborhood: neighborhood || undefined,
    };
  }

  private async geocodeCity(
    city: string,
    state: string,
  ): Promise<{ latitude: number; longitude: number } | null> {
    const hits = await this.nominatimSearch({
      city,
      state,
      country: 'Brasil',
      limit: 1,
    });
    const hit = hits[0];
    const latitude = hit?.lat ? Number(hit.lat) : NaN;
    const longitude = hit?.lon ? Number(hit.lon) : NaN;
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return null;
    }
    return { latitude, longitude };
  }

  private async nominatimSearch(
    params: Record<string, string | number>,
  ): Promise<NominatimResult[]> {
    try {
      const { data } = await axios.get<NominatimResult[]>(
        'https://nominatim.openstreetmap.org/search',
        {
          params: {
            format: 'json',
            addressdetails: 1,
            countrycodes: 'br',
            ...params,
          },
          timeout: 15000,
          headers: {
            'User-Agent': NOMINATIM_UA,
            Accept: 'application/json',
          },
        },
      );
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.logger.warn(`Nominatim search failed: ${(error as Error).message}`);
      return [];
    }
  }

  private isNeighborhoodHit(hit: NominatimResult, query: string): boolean {
    const type = (hit.type || '').toLowerCase();
    if (NEIGHBORHOOD_TYPES.has(type)) return true;
    const addressName =
      hit.address?.suburb ||
      hit.address?.neighbourhood ||
      hit.address?.city_district;
    if (!addressName) return false;
    const q = this.normalize(query);
    return this.normalize(addressName).includes(q);
  }

  private mapNeighborhood(
    hit: NominatimResult,
    city: string,
    state: string,
  ): NeighborhoodSuggestion | null {
    const name = (
      hit.address?.suburb ||
      hit.address?.neighbourhood ||
      hit.address?.city_district ||
      hit.name ||
      ''
    ).trim();
    const box = hit.boundingbox;
    if (!name || !box || box.length !== 4) return null;
    const bbox = bboxFromNominatimBox(box);
    const latitude = hit.lat ? Number(hit.lat) : NaN;
    const longitude = hit.lon ? Number(hit.lon) : NaN;
    if (!bbox || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return null;
    }
    return {
      name,
      city,
      state,
      label: `${name} · ${city}-${state}`,
      latitude,
      longitude,
      bbox,
    };
  }

  private async ensureLoaded(): Promise<void> {
    if (this.cities.length) {
      return;
    }
    if (!this.loadPromise) {
      this.loadPromise = this.loadFromIbge().finally(() => {
        this.loadPromise = null;
      });
    }
    await this.loadPromise;
  }

  private async loadFromIbge(): Promise<void> {
    try {
      const { data } = await axios.get<IbgeMunicipio[]>(
        'https://servicodados.ibge.gov.br/api/v1/localidades/municipios',
        {
          timeout: 30000,
          headers: { Accept: 'application/json' },
        },
      );

      this.cities = (data ?? [])
        .map((item) => {
          const state = item.microrregiao?.mesorregiao?.UF?.sigla?.trim();
          const name = item.nome?.trim();
          if (!state || !name) return null;
          return {
            id: item.id,
            name,
            state,
            label: `${name}-${state}`,
          } satisfies CitySuggestion;
        })
        .filter((item): item is CitySuggestion => Boolean(item))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

      this.logger.log(`Loaded ${this.cities.length} municipalities from IBGE`);
    } catch (error) {
      this.logger.warn(
        `Failed to load IBGE municipalities: ${(error as Error).message}`,
      );
      this.cities = [];
    }
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
