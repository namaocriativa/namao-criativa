import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const execFileAsync = promisify(execFile);

export type Crawl4aiPage = {
  url: string;
  html: string;
  cleanedHtml?: string | null;
  markdown?: string | null;
  fitMarkdown?: string | null;
  metadata?: Record<string, unknown>;
  media?: {
    images?: Array<{
      src?: string;
      alt?: string;
      title?: string;
      score?: number;
    }>;
  };
  links?: {
    internal?: Array<{ href?: string; text?: string }>;
    external?: Array<{ href?: string; text?: string }>;
  };
  success?: boolean;
  error?: string;
};

export type Crawl4aiCrawlResult = {
  ok: boolean;
  pages: Crawl4aiPage[];
  error?: string;
  via: 'docker' | 'python';
};

@Injectable()
export class Crawl4aiClient {
  private readonly logger = new Logger(Crawl4aiClient.name);

  constructor(private readonly config: ConfigService) {}

  async crawl(url: string, maxPages = 6): Promise<Crawl4aiCrawlResult | null> {
    const dockerUrl = this.config.get<string>('CRAWL4AI_URL')?.trim();
    if (dockerUrl) {
      return this.crawlViaDocker(dockerUrl.replace(/\/$/, ''), url, maxPages);
    }
    return this.crawlViaPython(url, maxPages);
  }

  /**
   * Fetches a single URL through the real browser and returns its raw HTML,
   * preserving external links. Useful for pages (e.g. search engines) that
   * block plain HTTP clients with anti-bot protections. Returns null when the
   * Docker service isn't configured.
   */
  async fetchPageHtml(url: string): Promise<string | null> {
    const dockerUrl = this.config.get<string>('CRAWL4AI_URL')?.trim();
    if (!dockerUrl) {
      return null;
    }

    const token = this.config.get<string>('CRAWL4AI_API_TOKEN')?.trim();
    try {
      const { data } = await axios.post(
        `${dockerUrl.replace(/\/$/, '')}/crawl`,
        {
          urls: [url],
          browser_config: {
            type: 'BrowserConfig',
            params: { headless: true },
          },
          crawler_config: {
            type: 'CrawlerRunConfig',
            params: {
              stream: false,
              cache_mode: 'bypass',
              page_timeout: 25000,
            },
          },
        },
        {
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          validateStatus: (status) => status >= 200 && status < 300,
        },
      );

      const result = Array.isArray(data?.results)
        ? data.results[0]
        : Array.isArray(data)
          ? data[0]
          : data;
      const html = result?.html ?? result?.cleaned_html;
      return typeof html === 'string' && html.length ? html : null;
    } catch (error) {
      this.logger.debug(
        `Crawl4AI fetchPageHtml failed for ${url}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async crawlViaDocker(
    baseUrl: string,
    url: string,
    maxPages: number,
  ): Promise<Crawl4aiCrawlResult | null> {
    try {
      const home = await this.dockerCrawl(baseUrl, [url]);
      const homepage = home[0];
      if (!homepage?.success && !homepage?.html) {
        this.logger.warn(
          `Crawl4AI Docker failed for ${url}: ${homepage?.error ?? 'sem HTML'}`,
        );
        return null;
      }

      const extra = this.pickRelevantLinks(homepage, url, Math.max(0, maxPages - 1));
      const extraPages =
        extra.length > 0 ? await this.dockerCrawl(baseUrl, extra) : [];

      const pages = [homepage, ...extraPages].filter(
        (page) => page.html || page.markdown,
      );
      if (!pages.length) {
        return null;
      }
      return { ok: true, pages, via: 'docker' };
    } catch (error) {
      this.logger.warn(
        `Crawl4AI Docker indisponível: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async dockerCrawl(
    baseUrl: string,
    urls: string[],
  ): Promise<Crawl4aiPage[]> {
    const token = this.config.get<string>('CRAWL4AI_API_TOKEN')?.trim();
    const { data } = await axios.post(
      `${baseUrl}/crawl`,
      {
        urls,
        browser_config: {
          type: 'BrowserConfig',
          params: { headless: true },
        },
        crawler_config: {
          type: 'CrawlerRunConfig',
          params: {
            stream: false,
            cache_mode: 'bypass',
            exclude_external_links: true,
            process_iframes: true,
            remove_overlay_elements: true,
            page_timeout: 25000,
          },
        },
      },
      {
        timeout: 120000,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );

    const rawResults = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : [];
    return rawResults.map((item: Record<string, unknown>) =>
      this.normalizeDockerPage(item),
    );
  }

  private normalizeDockerPage(item: Record<string, unknown>): Crawl4aiPage {
    const markdown = item.markdown;
    let rawMd: string | null = null;
    let fitMd: string | null = null;
    if (typeof markdown === 'string') {
      rawMd = markdown;
    } else if (markdown && typeof markdown === 'object') {
      const md = markdown as Record<string, unknown>;
      rawMd = typeof md.raw_markdown === 'string' ? md.raw_markdown : null;
      fitMd = typeof md.fit_markdown === 'string' ? md.fit_markdown : null;
    }

    return {
      url: String(item.url ?? ''),
      html: String(item.html ?? item.cleaned_html ?? ''),
      cleanedHtml:
        typeof item.cleaned_html === 'string' ? item.cleaned_html : null,
      markdown: rawMd,
      fitMarkdown: fitMd,
      metadata:
        item.metadata && typeof item.metadata === 'object'
          ? (item.metadata as Record<string, unknown>)
          : {},
      media:
        item.media && typeof item.media === 'object'
          ? (item.media as Crawl4aiPage['media'])
          : {},
      links:
        item.links && typeof item.links === 'object'
          ? (item.links as Crawl4aiPage['links'])
          : {},
      success: Boolean(item.success),
      error: typeof item.error_message === 'string' ? item.error_message : undefined,
    };
  }

  private pickRelevantLinks(
    page: Crawl4aiPage,
    origin: string,
    limit: number,
  ): string[] {
    const originUrl = new URL(origin);
    const found: string[] = [];
    const seen = new Set([origin.replace(/\/$/, '')]);
    for (const link of page.links?.internal ?? []) {
      if (!link.href) continue;
      try {
        const absolute = new URL(link.href, origin);
        if (absolute.origin !== originUrl.origin) continue;
        if (!this.isRelevantPath(absolute.pathname)) continue;
        absolute.hash = '';
        absolute.search = '';
        const key = absolute.toString().replace(/\/$/, '');
        if (seen.has(key)) continue;
        seen.add(key);
        found.push(absolute.toString());
        if (found.length >= limit) break;
      } catch {
        // ignore
      }
    }
    return found;
  }

  private isRelevantPath(pathname: string): boolean {
    const path = pathname.toLowerCase();
    return [
      'contato',
      'contact',
      'sobre',
      'about',
      'servico',
      'service',
      'quem-somos',
    ].some((token) => path.includes(token));
  }

  private async crawlViaPython(
    url: string,
    maxPages: number,
  ): Promise<Crawl4aiCrawlResult | null> {
    const python = this.resolvePython();
    const script = this.resolveScript();
    if (!python || !script) {
      this.logger.debug(
        'Crawl4AI Python não configurado (instale services/platform/crawler ou defina CRAWL4AI_URL).',
      );
      return null;
    }

    try {
      const { stdout } = await execFileAsync(
        python,
        [script, url, '--max-pages', String(maxPages)],
        {
          timeout: 120000,
          maxBuffer: 32 * 1024 * 1024,
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        },
      );
      const parsed = JSON.parse(stdout) as {
        ok?: boolean;
        pages?: Crawl4aiPage[];
        error?: string;
      };
      if (!parsed.ok || !parsed.pages?.length) {
        this.logger.warn(
          `Crawl4AI Python falhou para ${url}: ${parsed.error ?? 'sem páginas'}`,
        );
        return null;
      }
      return { ok: true, pages: parsed.pages, via: 'python' };
    } catch (error) {
      this.logger.warn(
        `Crawl4AI Python indisponível: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private resolveScript(): string | null {
    const script = join(__dirname, '..', '..', '..', '..', 'crawler', 'crawl_site.py');
    return existsSync(script) ? script : null;
  }

  private resolvePython(): string | null {
    const configured = this.config.get<string>('CRAWL4AI_PYTHON')?.trim();
    if (configured && existsSync(configured)) {
      return configured;
    }
    if (configured) {
      return configured;
    }

    const serverRoot = join(__dirname, '..', '..', '..', '..');
    const venvUnix = join(serverRoot, 'crawler', '.venv', 'bin', 'python');
    const venvWin = join(
      serverRoot,
      'crawler',
      '.venv',
      'Scripts',
      'python.exe',
    );
    if (existsSync(venvUnix)) return venvUnix;
    if (existsSync(venvWin)) return venvWin;
    return 'python3';
  }
}
