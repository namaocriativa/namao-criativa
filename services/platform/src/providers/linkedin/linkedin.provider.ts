import { Injectable } from '@nestjs/common';
import { LeadProvider } from '../provider.interface';
import { EnrichmentInput, ProviderResult } from '../provider.types';

/**
 * Stub: preserves LinkedIn URL already known from input or other providers.
 * No authenticated scraping in v1.
 */
@Injectable()
export class LinkedInProvider implements LeadProvider {
  readonly name = 'linkedin';

  async enrich(input: EnrichmentInput): Promise<ProviderResult | null> {
    if (!input.linkedin) {
      return null;
    }

    const url = input.linkedin.startsWith('http')
      ? input.linkedin
      : `https://www.linkedin.com/${input.linkedin.replace(/^\//, '')}`;

    return {
      provider: this.name,
      sourceUrl: url,
      data: {
        linkedin: url,
      },
      raw: {
        note: 'Stub provider — profile/page URL preserved from known data',
        url,
      },
    };
  }
}
