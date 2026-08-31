import { Injectable, Logger } from '@nestjs/common';
import { LeadProvider } from '../provider.interface';
import {
  EnrichmentInput,
  ProviderImage,
  ProviderResult,
} from '../provider.types';
import { WebsitePageExtractor } from '../website/website.extractor';
import { Crawl4aiClient, Crawl4aiPage } from './crawl4ai.client';

@Injectable()
export class Crawl4aiProvider implements LeadProvider {
  readonly name = 'crawl4ai';
  private readonly logger = new Logger(Crawl4aiProvider.name);
  private readonly extractor = new WebsitePageExtractor();

  constructor(private readonly client: Crawl4aiClient) {}

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
      const crawled = await this.client.crawl(baseUrl.toString(), 6);
      if (!crawled?.pages.length) {
        return null;
      }

      const extractions = crawled.pages
        .filter((page) => page.html)
        .map((page) => this.extractor.extractFromHtml(page.html, baseUrl));

      const merged = this.extractor.mergePageExtractions(extractions);
      this.applyCrawlMetadata(merged.data, crawled.pages);
      const images = this.mergeImages(
        merged.images,
        crawled.pages,
        baseUrl,
      );

      const hasData =
        merged.data.description ||
        merged.data.phone ||
        merged.data.email ||
        merged.data.instagram ||
        merged.data.facebook ||
        merged.data.linkedin ||
        (merged.data.services && merged.data.services.length > 0) ||
        images.length > 0 ||
        merged.data.name;

      if (!hasData) {
        return null;
      }

      return {
        provider: this.name,
        sourceUrl: baseUrl.toString(),
        data: {
          website: baseUrl.toString(),
          ...merged.data,
          metadata: {
            ...(merged.data.metadata ?? {}),
            crawl4ai: {
              via: crawled.via,
              pages: crawled.pages.map((page) => page.url),
            },
          },
        },
        images,
        raw: {
          via: crawled.via,
          pagesFetched: crawled.pages.length,
          urls: crawled.pages.map((page) => page.url),
        },
      };
    } catch (error) {
      this.logger.warn(
        `Crawl4AI enrich failed for ${input.website}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private applyCrawlMetadata(
    data: ProviderResult['data'],
    pages: Crawl4aiPage[],
  ) {
    for (const page of pages) {
      const meta = page.metadata ?? {};
      const title =
        this.metaString(meta, 'title') ||
        this.metaString(meta, 'ogTitle') ||
        this.metaString(meta, 'og:title');
      const description =
        this.metaString(meta, 'description') ||
        this.metaString(meta, 'ogDescription') ||
        this.metaString(meta, 'og:description');

      if (!data.name && title) {
        data.name = title;
      }
      if (!data.description && description) {
        data.description = description.slice(0, 800);
      }
    }
  }

  private metaString(meta: Record<string, unknown>, key: string): string | null {
    const value = meta[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private mergeImages(
    extracted: ProviderImage[],
    pages: Crawl4aiPage[],
    baseUrl: URL,
  ): ProviderImage[] {
    const images = [...extracted];
    const seen = new Set(extracted.map((img) => img.url));

    for (const page of pages) {
      for (const img of page.media?.images ?? []) {
        if (!img.src) continue;
        try {
          const absolute = new URL(img.src, baseUrl).toString();
          if (!/^https?:/i.test(absolute) || seen.has(absolute)) continue;
          seen.add(absolute);
          const label = `${img.alt ?? ''} ${img.title ?? ''}`.toLowerCase();
          images.push({
            url: absolute,
            kind: label.includes('logo') ? 'logo' : 'photo',
          });
        } catch {
          // ignore
        }
      }
    }

    return images.slice(0, 15);
  }
}
