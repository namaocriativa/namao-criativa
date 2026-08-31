import {
  DiscoveryQuery,
  DiscoveryResult,
  EnrichmentInput,
  ProviderResult,
} from './provider.types';

export const LEAD_PROVIDERS = Symbol('LEAD_PROVIDERS');

export interface LeadProvider {
  readonly name: string;
  enrich(input: EnrichmentInput): Promise<ProviderResult | null>;
  discover?(query: DiscoveryQuery): Promise<DiscoveryResult[]>;
}
