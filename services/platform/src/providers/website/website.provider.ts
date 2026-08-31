import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { LeadProvider } from '../provider.interface';
import { EnrichmentInput, ProviderResult } from '../provider.types';
import { WebsitePageExtractor } from './website.extractor';

@Injectable()
export class WebsiteProvider implements LeadProvider {
  readonly name = 'website';
  private readonly logger = new Logger(WebsiteProvider.name);
  private readonly extractor = new WebsitePageExtractor();

  async enrich(input: EnrichmentInput): Promise<ProviderResult | null> {
    if (!input.website) {
      return null;
    }

    let baseUrl: URL;
    try {
      baseUrl = new URL(
        input.website.startsWith('http')
          ? input.website
          : `https://${input.website}`,
      );
    } catch {
      return null;
    }

    try {
      const homepageHtml = await this.fetchHtml(baseUrl.toString());
      if (!homepageHtml) {
        return null;
      }

      const pages: string[] = [homepageHtml];
      const $home = cheerio.load(homepageHtml);
      const extraUrls = this.extractor.collectRelevantLinks($home, baseUrl);

      for (const url of extraUrls.slice(0, 5)) {
        const html = await this.fetchHtml(url);
        if (html) {
          pages.push(html);
        }
      }

      const merged = this.extractor.mergePageExtractions(
        pages.map((html) => this.extractor.extractFromHtml(html, baseUrl)),
      );

      return {
        provider: this.name,
        sourceUrl: baseUrl.toString(),
        data: {
          website: baseUrl.toString(),
          ...merged.data,
        },
        images: merged.images,
        raw: {
          pagesFetched: pages.length,
          title: merged.data.name,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Website enrich failed for ${input.website}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async fetchHtml(url: string): Promise<string | null> {
    try {
      const { data, headers } = await axios.get<string>(url, {
        timeout: 12000,
        maxContentLength: 2 * 1024 * 1024,
        headers: {
          'User-Agent':
            'discovery-lead-enrichment/1.0 (+https://localhost; lead-enrichment)',
          Accept: 'text/html,application/xhtml+xml',
        },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      const contentType = String(headers['content-type'] ?? '');
      if (contentType && !contentType.includes('text/html')) {
        return null;
      }
      return typeof data === 'string' ? data : null;
    } catch (error) {
      this.logger.debug(`Fetch failed ${url}: ${(error as Error).message}`);
      return null;
    }
  }
}
