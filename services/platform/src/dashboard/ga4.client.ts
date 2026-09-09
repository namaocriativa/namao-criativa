import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Ga4DateRange = { startDate: string; endDate: string };

export type Ga4MetricRow = {
  dimensionValues: string[];
  metricValues: number[];
};

@Injectable()
export class Ga4Client {
  private readonly logger = new Logger(Ga4Client.name);
  private client: BetaAnalyticsDataClient | null | undefined;

  constructor(private readonly config: ConfigService) {}

  propertyId(): string {
    const raw = this.config.get<string>('GA4_PROPERTY_ID')?.trim() || '';
    return raw.replace(/^properties\//, '');
  }

  configured(): boolean {
    return Boolean(this.propertyId() && this.credentials());
  }

  async runReport(opts: {
    dimensions: string[];
    metrics: string[];
    dateRange: Ga4DateRange;
    hostname: string;
    limit?: number;
  }): Promise<Ga4MetricRow[]> {
    const client = this.ensureClient();
    const property = this.propertyId();
    if (!client || !property) return [];

    const [response] = await client.runReport({
      property: `properties/${property}`,
      dateRanges: [opts.dateRange],
      dimensions: opts.dimensions.map((name) => ({ name })),
      metrics: opts.metrics.map((name) => ({ name })),
      limit: opts.limit,
      dimensionFilter: {
        filter: {
          fieldName: 'hostName',
          stringFilter: { matchType: 'EXACT', value: opts.hostname },
        },
      },
    });

    return (response.rows || []).map((row) => ({
      dimensionValues: (row.dimensionValues || []).map((item) =>
        String(item.value || ''),
      ),
      metricValues: (row.metricValues || []).map((item) =>
        Number(item.value || 0),
      ),
    }));
  }

  private credentials(): Record<string, unknown> | null {
    const raw = this.config.get<string>('GA4_SERVICE_ACCOUNT_JSON')?.trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      const credentials = { ...(parsed as Record<string, unknown>) };
      if (typeof credentials.private_key === 'string') {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      return credentials;
    } catch (error) {
      this.logger.warn(
        `GA4_SERVICE_ACCOUNT_JSON inválido: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private ensureClient(): BetaAnalyticsDataClient | null {
    if (this.client !== undefined) return this.client;
    const credentials = this.credentials();
    if (!credentials) {
      this.client = null;
      return null;
    }
    this.client = new BetaAnalyticsDataClient({ credentials });
    return this.client;
  }
}
