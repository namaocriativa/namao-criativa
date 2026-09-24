import { CAROUSEL_INSTAGRAM_ID } from './creative-features';

export const MIN_CAROUSEL_SLIDES = 3;
export const MAX_CAROUSEL_SLIDES = 7;
export const DEFAULT_CAROUSEL_SLIDES = 5;

export const CAROUSEL_SLIDE_ROLES = [
  'cover',
  'tip',
  'proof',
  'offer',
  'cta',
] as const;

export type CarouselSlideRole = (typeof CAROUSEL_SLIDE_ROLES)[number];

export type CarouselSlideSpec = {
  index: number;
  role: CarouselSlideRole;
  headline: string;
  body: string;
  visual: string;
};

export type CarouselSpec = {
  caption: string;
  artDirection: string;
  palette: string;
  slides: CarouselSlideSpec[];
};

export type CarouselPlannerContext = {
  prompt: string;
  notes: string;
  slideCount: number;
};

const ROLE_LABEL: Record<CarouselSlideRole, string> = {
  cover: 'capa',
  tip: 'dica',
  proof: 'prova',
  offer: 'oferta',
  cta: 'CTA',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  const next = String(value).trim();
  return next || fallback;
}

export function clampSlideCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CAROUSEL_SLIDES;
  return Math.min(
    MAX_CAROUSEL_SLIDES,
    Math.max(MIN_CAROUSEL_SLIDES, Math.round(n)),
  );
}

export function roleForIndex(index: number, total: number): CarouselSlideRole {
  if (index <= 0) return 'cover';
  if (index >= total - 1) return 'cta';
  const mid = ['tip', 'proof', 'offer'] as const;
  return mid[(index - 1) % mid.length];
}

function parseRole(value: unknown, fallback: CarouselSlideRole): CarouselSlideRole {
  const raw = text(value).toLowerCase();
  if ((CAROUSEL_SLIDE_ROLES as readonly string[]).includes(raw)) {
    return raw as CarouselSlideRole;
  }
  return fallback;
}

function fallbackSlide(
  index: number,
  total: number,
  prompt: string,
): CarouselSlideSpec {
  const role = roleForIndex(index, total);
  const topic = prompt.slice(0, 80) || 'o tema do carrossel';
  const headlines: Record<CarouselSlideRole, string> = {
    cover: topic,
    tip: `O que muda na prática`,
    proof: `Por que isso funciona`,
    offer: `O próximo passo`,
    cta: `Salve e siga`,
  };
  const bodies: Record<CarouselSlideRole, string> = {
    cover: `Slide ${index + 1} de ${total}`,
    tip: 'Uma ideia clara, em uma frase.',
    proof: 'Mostre o resultado sem inventar números.',
    offer: 'Diga o que a pessoa ganha se continuar.',
    cta: 'Convide a salvar, comentar ou chamar no Direct.',
  };
  return {
    index: index + 1,
    role,
    headline: headlines[role],
    body: bodies[role],
    visual: 'Mesma paleta, tipografia grande, margens de feed 4:5, sem chrome de app.',
  };
}

export function parseCarouselSpec(
  value: unknown,
  context: CarouselPlannerContext,
): CarouselSpec {
  const slideCount = clampSlideCount(context.slideCount);
  const raw = asRecord(value) || {};
  const fromModel = Array.isArray(raw.slides) ? raw.slides : [];
  const slides: CarouselSlideSpec[] = [];
  for (let i = 0; i < slideCount; i += 1) {
    const item = asRecord(fromModel[i]);
    const fallback = fallbackSlide(i, slideCount, context.prompt);
    const role = parseRole(item?.role, fallback.role);
    slides.push({
      index: i + 1,
      role,
      headline: text(item?.headline, fallback.headline).slice(0, 120),
      body: text(item?.body, fallback.body).slice(0, 280),
      visual: text(item?.visual, fallback.visual).slice(0, 400),
    });
  }
  if (slides.length < MIN_CAROUSEL_SLIDES) {
    throw new Error('O planner do carrossel precisa de ao menos 3 slides');
  }
  return {
    caption: text(
      raw.caption,
      `${context.prompt.slice(0, 140)}\n\nSalve para não perder.`.trim(),
    ).slice(0, 2200),
    artDirection: text(
      raw.artDirection,
      'Feed 4:5, tipografia bold, pouco texto, identidade visual única em todos os slides.',
    ).slice(0, 600),
    palette: text(
      raw.palette,
      'Fundo escuro, acentos magenta/ciano, alto contraste.',
    ).slice(0, 200),
    slides,
  };
}

export function buildCarouselPlannerPrompt(context: CarouselPlannerContext): string {
  const slideCount = clampSlideCount(context.slideCount);
  return `Você é diretor de arte e copywriter da Namão Criativa.
Planeje um CARROSSEL de Instagram para o feed (formato 4:5).
Responda APENAS um JSON com este shape:
{
  "caption": "legenda do post, português do Brasil, com quebras de linha",
  "artDirection": "direção de arte comum a todos os slides",
  "palette": "paleta em 1 linha",
  "slides": [
    {
      "role": "cover|tip|proof|offer|cta",
      "headline": "frase curta na arte",
      "body": "apoio curto ou vazio",
      "visual": "o que aparece neste slide"
    }
  ]
}

Regras:
- Exatamente ${slideCount} slides, na ordem de leitura.
- Slide 1 é cover. O último é cta. Os do meio alternam tip, proof e offer.
- Headline cabe em 2 linhas no celular. Sem parágrafo longo na arte.
- Não invente depoimentos, preços, WhatsApp, @ ou números que o briefing não trouxe.
- Textos visíveis em português do Brasil.
- Caption é a legenda do post (não vai na arte), até 2.200 caracteres.
- Feature id: ${CAROUSEL_INSTAGRAM_ID}

BRIEFING
${context.prompt.trim()}

NOTAS DO OPERADOR
${context.notes.trim() || '(nenhuma nota extra)'}
`;
}

export function buildCarouselSlidePrompt(
  spec: CarouselSpec,
  slide: CarouselSlideSpec,
  total: number,
): string {
  const quoted = (value: string) => `"${value.replace(/"/g, "'")}"`;
  const continuity =
    slide.index > 1
      ? 'The attached image is the previous slide. Keep the same palette, type style, margins and brand world. Do not copy its headline.'
      : 'This is the cover. Establish the look the rest of the carousel will follow.';
  return `Create Instagram feed carousel slide ${slide.index} of ${total} (portrait 4:5). Photorealistic graphic design, not a phone mockup.

LOCKED STRINGS — print these Brazilian Portuguese texts EXACTLY, with correct accents. Do not add extra prices, names, or testimonials.

Role: ${ROLE_LABEL[slide.role]} (${slide.role})
Headline: ${quoted(slide.headline)}
Body: ${slide.body ? quoted(slide.body) : '(no body text)'}
Visual: ${slide.visual}

SERIES LOOK
Art direction: ${spec.artDirection}
Palette: ${spec.palette}
${continuity}

RULES
- Aspect 4:5, safe margins for Instagram crop, large type, high contrast.
- One idea per slide. No tiny paragraphs. No UI chrome, no fake handles, no watermarks.
- Keep the same visual system across the carousel.
- Feature ${CAROUSEL_INSTAGRAM_ID}.
`;
}

export const CAROUSEL_SYSTEM_INSTRUCTION = `You are Namão Criativa's in-house art generator for Instagram feed carousels.
Always produce a 4:5 portrait slide that belongs to a series: shared palette, shared type, large readable copy.
Copy in the user prompt is sacred: print locked Brazilian Portuguese strings exactly.
Do not render Instagram UI, watermarks, fake @handles, or QR codes.`;
