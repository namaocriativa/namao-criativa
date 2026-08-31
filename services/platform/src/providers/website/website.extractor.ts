import * as cheerio from 'cheerio';
import { ProviderImage, ProviderResult } from '../provider.types';

export const RELEVANT_PATHS = [
  '/contato',
  '/contact',
  '/sobre',
  '/about',
  '/servicos',
  '/services',
  '/quem-somos',
];

export type PageExtraction = {
  data: ProviderResult['data'];
  images: ProviderImage[];
};

export class WebsitePageExtractor {
  extractFromHtml(html: string, baseUrl: URL): PageExtraction {
    const $ = cheerio.load(html);
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text().trim() ||
      null;
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null;

    const bodyText = $('body').text().replace(/\s+/g, ' ');
    const phones = this.extractPhones($, bodyText);
    const emails = this.extractEmails($, bodyText);
    const socials = this.extractSocialLinks($, baseUrl);
    const services = this.extractServices($);
    const images = this.extractImages($, baseUrl);

    // WhatsApp only from explicit wa.me / api.whatsapp.com links — inferring it
    // from arbitrary phone digits in the HTML produced false positives.
    const whatsapp = this.extractWhatsapp($);

    return {
      data: {
        name: title,
        description: description?.trim() || null,
        phone: phones[0] ?? null,
        whatsapp,
        email: emails[0] ?? null,
        instagram: socials.instagram,
        facebook: socials.facebook,
        linkedin: socials.linkedin,
        services: services.length ? services : null,
        metadata: {
          openGraph: {
            title: $('meta[property="og:title"]').attr('content') ?? null,
            description:
              $('meta[property="og:description"]').attr('content') ?? null,
            image: $('meta[property="og:image"]').attr('content') ?? null,
            url: $('meta[property="og:url"]').attr('content') ?? null,
          },
        },
      },
      images,
    };
  }

  mergePageExtractions(pages: PageExtraction[]) {
    const data: ProviderResult['data'] = {};
    const services = new Set<string>();
    const images: ProviderImage[] = [];
    const seenImages = new Set<string>();

    for (const page of pages) {
      for (const [key, value] of Object.entries(page.data)) {
        if (key === 'services' && Array.isArray(value)) {
          value.forEach((s) => services.add(s));
          continue;
        }
        if (key === 'metadata') continue;
        const current = (data as Record<string, unknown>)[key];
        if (
          (current === undefined || current === null || current === '') &&
          value !== undefined &&
          value !== null &&
          value !== ''
        ) {
          (data as Record<string, unknown>)[key] = value;
        }
      }
      if (page.data.metadata && !data.metadata) {
        data.metadata = page.data.metadata;
      }
      for (const img of page.images) {
        if (!seenImages.has(img.url)) {
          seenImages.add(img.url);
          images.push(img);
        }
      }
    }

    if (services.size) {
      data.services = [...services];
    }

    return { data, images: images.slice(0, 15) };
  }

  collectRelevantLinks($: cheerio.CheerioAPI, baseUrl: URL): string[] {
    const found = new Set<string>();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const absolute = new URL(href, baseUrl);
        if (absolute.origin !== baseUrl.origin) return;
        const path = absolute.pathname.toLowerCase();
        if (RELEVANT_PATHS.some((p) => path.includes(p.replace(/^\//, '')))) {
          absolute.hash = '';
          absolute.search = '';
          found.add(absolute.toString());
        }
      } catch {
        // ignore
      }
    });

    for (const p of RELEVANT_PATHS) {
      found.add(new URL(p, baseUrl).toString());
    }

    return [...found].filter((u) => u !== baseUrl.toString());
  }

  isRelevantPath(pathname: string): boolean {
    const path = pathname.toLowerCase();
    return RELEVANT_PATHS.some((p) => path.includes(p.replace(/^\//, '')));
  }

  private extractPhones($: cheerio.CheerioAPI, text: string): string[] {
    const found = new Set<string>();

    // Prefer explicit tel: links — the most reliable source.
    $('a[href^="tel:"]').each((_, el) => {
      const formatted = this.normalizeBrPhone(
        ($(el).attr('href') ?? '').replace(/^tel:/i, ''),
      );
      if (formatted) found.add(formatted);
    });

    // Text fallback: require a separator before the final block so random
    // digit runs (IDs, dates, inline scripts) don't get picked up.
    const pattern =
      /(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]\d{4}/g;
    for (const raw of text.match(pattern) ?? []) {
      const formatted = this.normalizeBrPhone(raw);
      if (formatted) found.add(formatted);
    }

    return [...found];
  }

  private normalizeBrPhone(raw: string): string | null {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length > 11) {
      digits = digits.slice(2);
    }
    if (digits.length < 10 || digits.length > 11) return null;

    const ddd = Number(digits.slice(0, 2));
    if (ddd < 11 || ddd > 99) return null;

    const rest = digits.slice(2);
    // 9-digit subscriber numbers (mobile) must start with 9.
    if (rest.length === 9 && !rest.startsWith('9')) return null;

    const mid = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `(${digits.slice(0, 2)}) ${mid}-${end}`;
  }

  private extractEmails($: cheerio.CheerioAPI, text: string): string[] {
    const found = new Set<string>();

    // Prefer explicit mailto: links.
    $('a[href^="mailto:"]').each((_, el) => {
      const email = decodeURIComponent(
        ($(el).attr('href') ?? '').replace(/^mailto:/i, '').split('?')[0],
      )
        .trim()
        .toLowerCase();
      if (this.isValidEmail(email)) found.add(email);
    });

    // Text fallback with strict validation to avoid garbage from collapsed
    // inline text (e.g. "EMAILfoo@bar.brSeja").
    const matches =
      text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
    for (const raw of matches) {
      // Reject uppercase runs that indicate a merged label like "EMAILfoo".
      if (/[A-Z]{3,}/.test(raw)) continue;
      const email = raw.toLowerCase();
      if (this.isValidEmail(email)) found.add(email);
    }

    return [...found];
  }

  private isValidEmail(email: string): boolean {
    if (!email || email.length > 254) return false;
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const [local, domain] = parts;
    if (local.length < 1 || local.length > 40) return false;
    if (!/^[a-z0-9._%+-]+$/.test(local)) return false;
    if (/\.(png|jpe?g|gif|svg|webp|bmp|ico)$/.test(domain)) return false;
    if (domain.includes('example.') || domain.includes('sentry')) return false;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,6}$/.test(domain)) return false;
    const tld = domain.split('.').pop() ?? '';
    if (tld.length > 4) return false;
    return true;
  }

  private extractSocialLinks($: cheerio.CheerioAPI, baseUrl: URL) {
    let instagram: string | null = null;
    let facebook: string | null = null;
    let linkedin: string | null = null;

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      let absolute: string;
      try {
        absolute = new URL(href, baseUrl).toString();
      } catch {
        return;
      }
      if (!instagram && /instagram\.com/i.test(absolute)) {
        instagram = absolute;
      }
      if (!facebook && /facebook\.com|fb\.com/i.test(absolute)) {
        facebook = absolute;
      }
      if (!linkedin && /linkedin\.com/i.test(absolute)) {
        linkedin = absolute;
      }
    });

    return { instagram, facebook, linkedin };
  }

  private extractWhatsapp($: cheerio.CheerioAPI): string | null {
    let found: string | null = null;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const match = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|[?&]phone=)(\+?\d[\d\s-]*)/i.exec(
        href,
      );
      if (match) {
        const formatted = this.normalizeBrPhone(match[1]);
        if (formatted) found = formatted;
      }
    });
    return found;
  }

  private extractServices($: cheerio.CheerioAPI): string[] {
    const services = new Set<string>();
    const selectors = [
      '[class*="servic"] li',
      '[id*="servic"] li',
      'section[class*="servic"] h3',
      'section[class*="servic"] h2',
    ];
    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text && text.length > 2 && text.length < 120) {
          services.add(text);
        }
      });
    }
    return [...services].slice(0, 20);
  }

  private extractImages($: cheerio.CheerioAPI, baseUrl: URL): ProviderImage[] {
    const images: ProviderImage[] = [];
    const seen = new Set<string>();

    const push = (url: string | undefined, kind: 'logo' | 'photo') => {
      if (!url) return;
      try {
        const absolute = new URL(url, baseUrl).toString();
        if (seen.has(absolute)) return;
        if (!/^https?:/i.test(absolute)) return;
        seen.add(absolute);
        images.push({ url: absolute, kind });
      } catch {
        // ignore
      }
    };

    push($('meta[property="og:image"]').attr('content'), 'logo');
    push($('link[rel="icon"]').attr('href'), 'logo');
    push($('link[rel="apple-touch-icon"]').attr('href'), 'logo');

    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');
      const alt = ($(el).attr('alt') ?? '').toLowerCase();
      const cls = ($(el).attr('class') ?? '').toLowerCase();
      const kind =
        alt.includes('logo') || cls.includes('logo') ? 'logo' : 'photo';
      push(src, kind);
    });

    return images.slice(0, 15);
  }
}
