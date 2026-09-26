import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ChatTrustedContext = {
  name: string;
  city: string | null;
  state: string | null;
  services: string[] | null;
  description: string | null;
  contacts: {
    phone?: string;
    whatsapp?: string;
    email?: string;
    website?: string;
    address?: string | null;
  };
};

export type ChatLpContext = {
  titles: string[];
  faq: Array<{ question: string; answer: string }>;
  features: string[];
};

export type ChatPromptContext = {
  leadId: string;
  trusted: ChatTrustedContext;
  lp: ChatLpContext;
  untrusted: string;
};

const UNTRUSTED_MAX = 4000;

const EMPTY_TRUSTED: ChatTrustedContext = {
  name: '',
  city: null,
  state: null,
  services: null,
  description: null,
  contacts: {},
};

@Injectable()
export class ChatContextBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(leadId: string): Promise<ChatPromptContext> {
    const include = { sources: true };
    const lead =
      (await this.prisma.lead.findUnique({
        where: { id: leadId },
        include,
      })) ||
      (await this.prisma.customer.findUnique({
        where: { id: leadId },
        include,
      }));
    if (!lead) {
      return {
        leadId,
        trusted: EMPTY_TRUSTED,
        lp: { titles: [], faq: [], features: [] },
        untrusted: '',
      };
    }

    const trusted = extractTrusted(lead);
    return {
      leadId: lead.id,
      trusted,
      lp: {
        titles: trusted.name ? [trusted.name] : [],
        faq: [],
        features: trusted.services || [],
      },
      untrusted: extractUntrusted(lead.sources),
    };
  }
}

export function extractTrusted(lead: {
  name: string;
  city: string | null;
  state: string | null;
  services: unknown;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
}): ChatTrustedContext {
  const services = Array.isArray(lead.services)
    ? lead.services.map(String).map((item) => item.trim()).filter(Boolean)
    : null;
  return {
    name: lead.name,
    city: lead.city,
    state: lead.state,
    services: services?.length ? services : null,
    description: lead.description,
    contacts: {
      ...(lead.phone ? { phone: lead.phone } : {}),
      ...(lead.whatsapp ? { whatsapp: lead.whatsapp } : {}),
      ...(lead.email ? { email: lead.email } : {}),
      ...(lead.website ? { website: lead.website } : {}),
      address: lead.address,
    },
  };
}

export function extractLpContent(spec: unknown): ChatLpContext {
  const lp: ChatLpContext = { titles: [], faq: [], features: [] };
  if (!spec || typeof spec !== 'object') return lp;
  const raw = spec as {
    features?: Array<{ id?: unknown }>;
    sections?: Array<{
      type?: unknown;
      props?: Record<string, unknown>;
    }>;
  };
  lp.features = (raw.features || [])
    .map((item) => String(item?.id || '').trim())
    .filter(Boolean);
  for (const section of raw.sections || []) {
    const props = section.props || {};
    for (const key of ['title', 'headline', 'brand']) {
      const value = String(props[key] || '').trim();
      if (value) lp.titles.push(value);
    }
    if (section.type === 'faq' && Array.isArray(props.items)) {
      for (const item of props.items) {
        if (!item || typeof item !== 'object') continue;
        const row = item as { question?: unknown; answer?: unknown };
        const question = String(row.question || '').trim();
        const answer = String(row.answer || '').trim();
        if (question && answer) lp.faq.push({ question, answer });
      }
    }
  }
  return lp;
}

export function extractUntrusted(
  sources: Array<{ provider?: string; url?: string | null; data?: unknown }>,
): string {
  const chunks: string[] = [];
  for (const source of sources || []) {
    const label = [source.provider, source.url].filter(Boolean).join(' ');
    const body = stringifySourceData(source.data);
    if (!body) continue;
    chunks.push(`${label}: ${body}`);
  }
  return chunks.join('\n').slice(0, UNTRUSTED_MAX);
}

function stringifySourceData(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data.trim();
  try {
    return JSON.stringify(data);
  } catch {
    return '';
  }
}
