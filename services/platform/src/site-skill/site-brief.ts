import type {
  SiteBriefFact,
  SiteBriefGap,
  SiteBriefImage,
  SiteImageSection,
  SiteSkillBrief,
} from './site-skill.contract';

const MAX_SIZED_PHOTOS = 5;
const MAX_UNSIZED_PHOTOS = 4;
const PHOTO_SECTIONS: SiteImageSection[] = [
  'hero',
  'about',
  'services',
  'services',
  'contact',
];

export const IG_BRIEF_NOTICE =
  'Rode a Skill Instagram para importar público, voz e temas. Este briefing usa o cadastro do lead.';

export type SiteBriefSourceImage = {
  filename?: string | null;
  localPath?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  width?: number | null;
  height?: number | null;
};

export type SiteBriefSource = {
  name?: string | null;
  category?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  instagram?: string | null;
  services?: unknown;
  images?: SiteBriefSourceImage[] | null;
};

export type SiteBriefIgJob = {
  id: string;
  createdAt: Date | string;
  report?: unknown;
} | null;

type IgRead = {
  who: string;
  sells: string;
  audience: string;
  stage: string;
  adjectives: string[];
  pillars: string[];
  username: string | null;
};

export function isLeadImageSelected(
  filename: string | null | undefined,
  selected: ReadonlySet<string>,
): boolean {
  const name = String(filename || '').trim();
  return Boolean(name) && selected.has(name);
}

export function buildSiteSkillBrief(
  source: SiteBriefSource,
  igJob: SiteBriefIgJob,
): SiteSkillBrief {
  const ig = readIg(igJob?.report);
  const facts: SiteBriefFact[] = [];
  const name = clean(source.name);
  const phone = clean(source.phone);
  const whatsapp = clean(source.whatsapp);
  const email = clean(source.email);
  const address = clean(source.address);
  const city = place(source.city, source.state);
  const instagram = clean(source.instagram);
  const category = clean(source.category);
  const description = clip(clean(source.description), 400);
  const services = servicesText(source.services);

  confirmed(facts, 'name', 'Nome do negócio', name);
  confirmed(facts, 'phone', 'Telefone', phone);
  confirmed(facts, 'whatsapp', 'WhatsApp', whatsapp);
  confirmed(facts, 'email', 'E-mail', email);
  confirmed(facts, 'address', 'Endereço', address);
  confirmed(facts, 'city', 'Cidade', city);
  confirmed(facts, 'instagram', 'Instagram', instagram);

  identified(
    facts,
    'category',
    'Área de atuação',
    category,
    'Cadastro do lead',
  );
  identified(
    facts,
    'description',
    'Descrição',
    description,
    'Cadastro do lead',
  );
  if (services) {
    identified(
      facts,
      'services',
      'Serviços oferecidos',
      services,
      'Cadastro do lead',
    );
  } else if (ig?.sells) {
    identified(
      facts,
      'services',
      'Serviços oferecidos',
      ig.sells,
      'Bio e publicações',
    );
  }
  if (ig?.who && ig.who !== name) {
    identified(facts, 'who', 'Leitura do perfil', ig.who, 'Análise da IA');
  }
  if (ig?.sells && services && ig.sells !== services) {
    identified(
      facts,
      'sells',
      'O que o Instagram comunica',
      ig.sells,
      'Bio e publicações',
    );
  }
  if (ig?.audience) {
    identified(
      facts,
      'audience',
      'Público identificado',
      ig.audience,
      'Análise da IA',
    );
  }
  if (ig?.stage) {
    identified(
      facts,
      'stage',
      'Estágio da comunicação',
      ig.stage,
      'Análise da IA',
    );
  }
  if (ig?.pillars.length) {
    identified(
      facts,
      'pillars',
      'Temas e diferenciais',
      ig.pillars.join(', '),
      'Análise da IA',
    );
  }
  if (ig?.adjectives.length) {
    identified(
      facts,
      'voice',
      'Tom de voz',
      ig.adjectives.join(', '),
      'Análise da IA',
    );
  }

  const gaps: SiteBriefGap[] = [
    {
      key: 'commercial',
      label: 'Condições comerciais',
      note: 'Preços, condições comerciais e disponibilidade não estão confirmados neste briefing. Não inventar.',
    },
  ];
  if (!whatsapp) {
    gaps.push({
      key: 'whatsapp',
      label: 'WhatsApp',
      note: phone
        ? 'Não há WhatsApp no cadastro. Use o telefone confirmado. Não inventar número.'
        : 'Não há telefone nem WhatsApp no cadastro. Não inventar contato.',
    });
  }
  if (!address && !city) {
    gaps.push({
      key: 'location',
      label: 'Localização',
      note: 'Não há endereço nem cidade no cadastro. Não inventar localização.',
    });
  }
  if (!services && !ig?.sells) {
    gaps.push({
      key: 'services',
      label: 'Serviços',
      note: 'Serviços não aparecem no cadastro nem na análise. Não inventar a oferta.',
    });
  }

  const handle =
    instagramHandle(instagram) || instagramHandle(ig?.username || '') || null;
  const igReady = Boolean(ig);
  return {
    handle,
    igReady,
    igJobId: igJob?.id || null,
    analyzedAt: igReady ? iso(igJob?.createdAt) : null,
    notice: igReady ? null : IG_BRIEF_NOTICE,
    facts,
    gaps,
    images: recommendImages(source.images || []),
    voice: ig?.adjectives || [],
    pillars: ig?.pillars || [],
  };
}

function confirmed(
  facts: SiteBriefFact[],
  key: string,
  label: string,
  value: string,
) {
  if (!value) return;
  facts.push({
    key,
    label,
    value,
    origin: 'Cadastro do lead',
    confidence: 'confirmed',
  });
}

function identified(
  facts: SiteBriefFact[],
  key: string,
  label: string,
  value: string,
  origin: string,
) {
  if (!value) return;
  facts.push({
    key,
    label,
    value,
    origin,
    confidence: 'identified',
  });
}

function recommendImages(images: SiteBriefSourceImage[]): SiteBriefImage[] {
  const rows = images
    .map((image, index) => toImage(image, index))
    .filter((image): image is SiteBriefImage & { index: number } =>
      Boolean(image),
    );
  const photos = rows.filter((image) => image.kind === 'photo');
  const sized = photos.filter((image) => image.width && image.height);
  const pool = (sized.length ? sized : photos).slice();
  pool.sort((a, b) => {
    const areaA = (a.width || 0) * (a.height || 0);
    const areaB = (b.width || 0) * (b.height || 0);
    if (areaB !== areaA) return areaB - areaA;
    return a.index - b.index;
  });
  const limit = sized.length ? MAX_SIZED_PHOTOS : MAX_UNSIZED_PHOTOS;
  const picked = pool.slice(0, limit);
  const sectionByIndex = new Map<number, SiteImageSection>();
  picked.forEach((image, order) => {
    sectionByIndex.set(
      image.index,
      PHOTO_SECTIONS[Math.min(order, PHOTO_SECTIONS.length - 1)],
    );
  });
  const pickedIndexes = new Set(picked.map((image) => image.index));
  const firstLogo = rows.find((image) => image.kind === 'logo');
  return rows.map((image) => {
    const { index, ...rest } = image;
    if (rest.kind === 'logo') {
      return {
        ...rest,
        recommended: firstLogo?.index === index,
        section: 'hero',
      };
    }
    return {
      ...rest,
      recommended: pickedIndexes.has(index),
      section: sectionByIndex.get(index) || 'services',
    };
  });
}

function toImage(image: SiteBriefSourceImage, index: number) {
  const filename = clean(image.filename);
  if (!filename) return null;
  const width = numberOrNull(image.width);
  const height = numberOrNull(image.height);
  const localPath = clean(image.localPath);
  return {
    index,
    filename,
    src: localPath ? `/${localPath.replace(/^\/+/, '')}` : '',
    kind: /logo/i.test(`${filename} ${image.sourceUrl || ''}`)
      ? ('logo' as const)
      : ('photo' as const),
    width,
    height,
    recommended: false,
    section: 'services' as SiteImageSection,
  };
}

function readIg(report: unknown): IgRead | null {
  const raw = asRecord(report);
  if (!raw) return null;
  const overview = asRecord(raw.overview) || {};
  const voice = asRecord(raw.voice) || {};
  const corpus = asRecord(raw.corpus) || {};
  const read: IgRead = {
    who: clip(clean(overview.who), 240),
    sells: clip(clean(overview.sells), 400),
    audience: clip(clean(overview.audience), 240),
    stage: clip(clean(overview.stage), 80),
    adjectives: stringList(voice.adjectives, 5),
    pillars: stringList(raw.pillars, 6),
    username: clean(corpus.username) || null,
  };
  const hasSignal =
    read.who ||
    read.sells ||
    read.audience ||
    read.stage ||
    read.adjectives.length ||
    read.pillars.length;
  return hasSignal ? read : null;
}

function servicesText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((item) => clean(item))
      .filter(Boolean)
      .join(', ');
  }
  return clip(clean(value), 400);
}

function instagramHandle(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const fromUrl = raw.match(/instagram\.com\/([^/?#]+)/i);
  const name = (fromUrl?.[1] || raw).replace(/^@/, '').replace(/\/$/, '');
  if (!name || name === 'p' || name === 'reel' || name === 'stories')
    return null;
  return name.slice(0, 64);
}

function place(city: unknown, state: unknown): string {
  return [clean(city), clean(state)].filter(Boolean).join(' / ');
}

function iso(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function numberOrNull(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function clean(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => clean(item))
    .filter(Boolean)
    .slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
