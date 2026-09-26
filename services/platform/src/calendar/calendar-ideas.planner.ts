import type { LeadBrief } from '../owner/lead-brief';
import {
  HOOK_MAX_WORDS,
  clampWords,
  withSaveOrCommentCta,
} from '../creative-studio/copy-limits';

export const CALENDAR_IDEA_FORMATS = [
  'carousel',
  'reel',
  'static',
] as const;

export type CalendarIdeaFormat = (typeof CALENDAR_IDEA_FORMATS)[number];

export type CalendarIdea = {
  title: string;
  hook: string;
  caption: string;
  format: CalendarIdeaFormat;
  commentKeyword?: string;
};

export type CalendarIdeasSpec = {
  pains: string[];
  hooks: string[];
  ideas: CalendarIdea[];
};

export type CalendarIdeasContext = {
  brief: LeadBrief;
  notes: string;
};

const MIN_PAINS = 8;
const MAX_PAINS = 10;
const IDEA_COUNT = 5;

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

function parseFormat(value: unknown, fallback: CalendarIdeaFormat): CalendarIdeaFormat {
  const raw = text(value).toLowerCase();
  if ((CALENDAR_IDEA_FORMATS as readonly string[]).includes(raw)) {
    return raw as CalendarIdeaFormat;
  }
  return fallback;
}

function nicheLabel(brief: LeadBrief): string {
  return brief.category || brief.name || 'o negócio';
}

function fallbackPains(brief: LeadBrief): string[] {
  const niche = nicheLabel(brief);
  return [
    `Ninguém encontra ${niche} no Google`,
    `O Instagram não traz cliente`,
    `O perfil parece amador`,
    `Demora para responder no WhatsApp`,
    `Concorrente aparece primeiro`,
    `Não sabe o que postar`,
    `Foto ruim afasta o cliente`,
    `Oferta some no feed`,
    `Sem prova social visível`,
    `Cliente some depois do orçamento`,
  ];
}

function fallbackHooks(pains: string[]): string[] {
  return pains.map((pain) => clampWords(pain, HOOK_MAX_WORDS, pain));
}

function fallbackIdeas(brief: LeadBrief, pains: string[]): CalendarIdea[] {
  const formats: CalendarIdeaFormat[] = [
    'carousel',
    'reel',
    'static',
    'carousel',
    'reel',
  ];
  return formats.map((format, index) => {
    const pain = pains[index] || pains[0] || nicheLabel(brief);
    const hook = clampWords(pain, HOOK_MAX_WORDS, pain);
    const keyword = 'EU QUERO';
    return {
      title: clampWords(hook, 8, hook),
      hook,
      caption: withSaveOrCommentCta(
        `${hook}\n\n${brief.description || brief.category || brief.name}\n\nComenta ${keyword}`,
      ),
      format,
      commentKeyword: keyword,
    };
  });
}

export function parseCalendarIdeasSpec(
  value: unknown,
  context: CalendarIdeasContext,
): CalendarIdeasSpec {
  const raw = asRecord(value) || {};
  const fallbackPainList = fallbackPains(context.brief);
  const fromPains = Array.isArray(raw.pains) ? raw.pains : [];
  const pains: string[] = [];
  for (let i = 0; i < MAX_PAINS; i += 1) {
    const next = text(fromPains[i], fallbackPainList[i] || '');
    if (next) pains.push(next);
    if (pains.length >= MAX_PAINS) break;
  }
  while (pains.length < MIN_PAINS) {
    pains.push(fallbackPainList[pains.length] || `Dor ${pains.length + 1}`);
  }

  const fromHooks = Array.isArray(raw.hooks) ? raw.hooks : [];
  const hooks = pains.map((pain, index) =>
    clampWords(text(fromHooks[index], pain), HOOK_MAX_WORDS, pain),
  );

  const fromIdeas = Array.isArray(raw.ideas) ? raw.ideas : [];
  const defaults = fallbackIdeas(context.brief, pains);
  const ideas: CalendarIdea[] = [];
  for (let i = 0; i < IDEA_COUNT; i += 1) {
    const item = asRecord(fromIdeas[i]);
    const fallback = defaults[i];
    const hook = clampWords(
      text(item?.hook, fallback.hook),
      HOOK_MAX_WORDS,
      fallback.hook,
    );
    const keyword = text(item?.commentKeyword, fallback.commentKeyword || '')
      .slice(0, 24)
      .toUpperCase();
    ideas.push({
      title: clampWords(text(item?.title, fallback.title), 8, fallback.title).slice(
        0,
        200,
      ),
      hook,
      caption: withSaveOrCommentCta(
        text(item?.caption, fallback.caption),
      ).slice(0, 2200),
      format: parseFormat(item?.format, fallback.format),
      ...(keyword ? { commentKeyword: keyword } : {}),
    });
  }

  return { pains, hooks, ideas };
}

function briefLines(brief: LeadBrief): string {
  return [
    `Nome: ${brief.name}`,
    `Categoria: ${brief.category || '—'}`,
    `Cidade: ${[brief.city, brief.state].filter(Boolean).join('/') || '—'}`,
    `Descrição: ${brief.description || '—'}`,
    `Serviços: ${(brief.services || []).join(', ') || '—'}`,
    `Instagram: ${brief.contacts.instagram || '—'}`,
    brief.rating != null
      ? `Nota real (não inventar outra): ${brief.rating}${brief.reviewCount != null ? ` (${brief.reviewCount} avaliações)` : ''}`
      : 'Nota: não invente rating, resultado ou depoimento',
  ].join('\n');
}

export function buildCalendarIdeasPrompt(context: CalendarIdeasContext): string {
  return `Você é estrategista de conteúdo da Namão Criativa.
Planeje dores, hooks e ideias de post para o Instagram deste negócio.
Responda APENAS um JSON com este shape:
{
  "pains": ["dor 1", "dor 2"],
  "hooks": ["hook 1", "hook 2"],
  "ideas": [
    {
      "title": "título curto do post",
      "hook": "até 10 palavras",
      "caption": "legenda com CTA de save ou comentário",
      "format": "carousel|reel|static",
      "commentKeyword": "PALAVRA"
    }
  ]
}

Regras:
- 8 a 10 dores reais da audiência deste nicho. Sem clichê genérico de "empreendedor".
- hooks tem o mesmo tamanho de pains, 1:1. Cada hook tem no máximo ${HOOK_MAX_WORDS} palavras, direto e provocativo.
- Exatamente 5 ideas. title até 8 palavras. caption em português do Brasil, com save ou "comenta X".
- Não invente rating, resultado, preço, WhatsApp, @ ou depoimento que o brief não trouxe.
- Use só fatos do brief. Se faltar dado, fale da dor — não invente número.

BRIEF
${briefLines(context.brief)}

NOTAS DO OPERADOR
${context.notes.trim() || '(nenhuma nota extra)'}
`;
}
