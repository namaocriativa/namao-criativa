import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Crawl4aiClient } from '../crawl4ai/crawl4ai.client';
import { EnrichmentInput } from '../provider.types';
import {
  hostnameOf,
  normalizeCandidateWebsite,
  selectOfficialWebsite,
} from './official-website';

const SEARCH_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

@Injectable()
export class WebsiteFinderService {
  private readonly logger = new Logger(WebsiteFinderService.name);

  constructor(private readonly crawl4ai: Crawl4aiClient) {}

  /**
   * Attempts to discover the official website of a business by searching the
   * web for its name + location. Used as a fallback when structured providers
   * (Google Places / OSM) don't return a website tag.
   *
   * Returns null unless a candidate domain clearly relates to the business
   * name — directory/marketplace hits are never treated as the official site.
   */
  async findWebsite(input: EnrichmentInput): Promise<string | null> {
    const query = [input.name, input.city, input.state]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!query) return null;

    const candidates = await this.collectCandidates(query);
    if (!candidates.length) {
      this.logger.debug(`No website candidates for "${query}"`);
      return null;
    }

    const picked = selectOfficialWebsite(candidates, input.name);
    if (!picked) {
      this.logger.debug(
        `No official website for "${input.name}" among ${candidates.length} search hits`,
      );
      return null;
    }

    this.logger.log(`Website finder resolved "${input.name}" -> ${picked}`);
    return picked;
  }

  private async collectCandidates(query: string): Promise<string[]> {
    const html = await this.fetchSearchHtml(query);
    if (!html) return [];

    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const ordered: string[] = [];

    $('a').each((_, el) => {
      const resolved = this.resolveHref($(el).attr('href'));
      const normalized = normalizeCandidateWebsite(resolved);
      if (!normalized) return;
      const key = hostnameOf(normalized);
      if (!key || seen.has(key)) return;
      seen.add(key);
      ordered.push(normalized);
    });

    return ordered;
  }

  private async fetchSearchHtml(query: string): Promise<string | null> {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;

    // Preferred: real browser via Crawl4AI (bypasses search-engine anti-bot).
    const viaBrowser = await this.crawl4ai.fetchPageHtml(url);
    if (viaBrowser) return viaBrowser;

    // Fallback: plain HTTP (works in some environments).
    try {
      const { data } = await axios.get<string>(url, {
        timeout: 12000,
        headers: { 'User-Agent': SEARCH_UA, Accept: 'text/html' },
      });
      return typeof data === 'string' ? data : null;
    } catch (error) {
      this.logger.debug(
        `Direct search fetch failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private resolveHref(href: string | undefined): string | null {
    if (!href) return null;
    try {
      const full = href.startsWith('http')
        ? href
        : href.startsWith('//')
          ? `https:${href}`
          : href;
      if (!full.startsWith('http')) return null;
      const url = new URL(full);
      if (url.hostname.includes('duckduckgo.com')) {
        const target = url.searchParams.get('uddg');
        return target ? decodeURIComponent(target) : null;
      }
      return full;
    } catch {
      return null;
    }
  }
}
