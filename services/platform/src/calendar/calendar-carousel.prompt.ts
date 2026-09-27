import axios from 'axios';
import type { LeadBrief } from '../owner/lead-brief';
import { WebsitePageExtractor } from '../providers/website/website.extractor';

const IG_HOSTS = new Set(['instagram.com', 'instagr.am']);

export type CarouselSkillPromptInput = {
  brief: LeadBrief;
  sourceUrl: string;
  notes?: string;
  snippet?: string;
};

export function normalizeSourceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const handle = trimmed.replace(/^@+/, '');
  if (trimmed.startsWith('@') && handle) {
    return `https://www.instagram.com/${handle.replace(/\/+$/, '')}/`;
  }
  if (
    !/^https?:\/\//i.test(trimmed) &&
    !trimmed.includes('/') &&
    !trimmed.includes('.')
  ) {
    return `https://www.instagram.com/${handle}/`;
  }
  const withProto = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withProto).toString();
  } catch {
    return '';
  }
}

export function isInstagramSourceUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeSourceUrl(raw) || raw);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    return IG_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function buildCarouselSkillPrompt(
  input: CarouselSkillPromptInput,
): string {
  const { brief, sourceUrl } = input;
  const lines = [
    `Carrossel Instagram para ${brief.name}.`,
    brief.category ? `Nicho: ${brief.category}.` : '',
    brief.description ? `Sobre: ${brief.description}` : '',
    brief.services?.length ? `Serviços: ${brief.services.join(', ')}` : '',
    brief.city
      ? `Cidade: ${brief.city}${brief.state ? `/${brief.state}` : ''}`
      : '',
    `Link do perfil: ${sourceUrl}`,
    brief.contacts.instagram
      ? `Instagram do brief: ${brief.contacts.instagram}`
      : '',
    brief.contacts.website ? `Site do brief: ${brief.contacts.website}` : '',
    input.snippet ? `Contexto do site:\n${input.snippet}` : '',
    input.notes?.trim() ? `Notas: ${input.notes.trim()}` : '',
    'Capa = dor, meio = dicas aplicáveis, último = save ou comenta X.',
    'Não invente rating, preço, WhatsApp ou depoimento que o brief não trouxe.',
  ];
  return lines.filter(Boolean).join('\n').slice(0, 4000);
}

export async function fetchWebsiteSnippet(sourceUrl: string): Promise<string> {
  if (isInstagramSourceUrl(sourceUrl)) return '';
  try {
    const { data } = await axios.get<string>(sourceUrl, {
      timeout: 8000,
      maxContentLength: 1 * 1024 * 1024,
      headers: {
        'User-Agent':
          'discovery-lead-enrichment/1.0 (+https://localhost; calendar-carousel)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!data || typeof data !== 'string') return '';
    const extracted = new WebsitePageExtractor().extractFromHtml(
      data,
      new URL(sourceUrl),
    );
    return [extracted.data.name, extracted.data.description]
      .map((item) => (item || '').trim())
      .filter(Boolean)
      .join('\n')
      .slice(0, 1200);
  } catch {
    return '';
  }
}
