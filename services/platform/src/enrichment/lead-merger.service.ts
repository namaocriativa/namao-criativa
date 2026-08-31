import { Injectable } from '@nestjs/common';
import { LeadFields, ProviderResult } from '../providers/provider.types';

const PROVIDER_PRIORITY = [
  'google',
  'crawl4ai',
  'website',
  'website-finder',
  'search',
  'instagram',
  'facebook',
  'linkedin',
  'input',
];

const SCALAR_FIELDS: (keyof LeadFields)[] = [
  'name',
  'category',
  'description',
  'phone',
  'whatsapp',
  'email',
  'website',
  'address',
  'city',
  'state',
  'country',
  'latitude',
  'longitude',
  'instagram',
  'facebook',
  'linkedin',
  'rating',
  'reviewCount',
];

@Injectable()
export class LeadMergerService {
  merge(
    initial: Partial<LeadFields>,
    results: ProviderResult[],
  ): Partial<LeadFields> {
    const ordered = [...results].sort(
      (a, b) =>
        PROVIDER_PRIORITY.indexOf(a.provider) -
        PROVIDER_PRIORITY.indexOf(b.provider),
    );

    const merged: Partial<LeadFields> = { ...this.compact(initial) };
    const services = new Set<string>(
      Array.isArray(initial.services) ? initial.services : [],
    );
    const metadata: Record<string, unknown> = {
      ...(initial.metadata ?? {}),
    };

    for (const result of ordered) {
      for (const field of SCALAR_FIELDS) {
        const current = merged[field];
        const next = result.data[field];
        if (this.isEmpty(current) && !this.isEmpty(next)) {
          (merged as Record<string, unknown>)[field] = next as unknown;
        }
      }

      if (Array.isArray(result.data.services)) {
        result.data.services.forEach((s) => {
          if (s?.trim()) services.add(s.trim());
        });
      }

      if (result.data.metadata) {
        metadata[result.provider] = result.data.metadata;
      }
    }

    if (services.size) {
      merged.services = [...services];
    }
    if (Object.keys(metadata).length) {
      merged.metadata = metadata;
    }

    return merged;
  }

  private compact(input: Partial<LeadFields>): Partial<LeadFields> {
    const out: Partial<LeadFields> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!this.isEmpty(value)) {
        (out as Record<string, unknown>)[key] = value;
      }
    }
    return out;
  }

  private isEmpty(value: unknown): boolean {
    return (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '')
    );
  }
}
