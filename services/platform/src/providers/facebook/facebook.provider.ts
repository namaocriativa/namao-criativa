import { Injectable } from '@nestjs/common';
import { LeadProvider } from '../provider.interface';
import { EnrichmentInput, ProviderResult } from '../provider.types';

/**
 * Stub: preserves Facebook URL already known from input or other providers.
 * No authenticated scraping in v1.
 */
@Injectable()
export class FacebookProvider implements LeadProvider {
  readonly name = 'facebook';

  async enrich(input: EnrichmentInput): Promise<ProviderResult | null> {
    if (!input.facebook) {
      return null;
    }

    const url = input.facebook.startsWith('http')
      ? input.facebook
      : `https://www.facebook.com/${input.facebook.replace(/^@/, '')}`;

    return {
      provider: this.name,
      sourceUrl: url,
      data: {
        facebook: url,
      },
      raw: {
        note: 'Stub provider — page URL preserved from known data',
        url,
      },
    };
  }
}
