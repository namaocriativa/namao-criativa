import type { LeadBrief } from '../owner/lead-brief';
import {
  BODY_MAX_WORDS,
  CTA_MAX_WORDS,
  HEADLINE_MAX_WORDS,
  HOOK_MAX_WORDS,
  STORY_MAX_WORDS,
  clampWords,
  withSaveOrCommentCta,
} from './copy-limits';
import { STATIC_INSTAGRAM_ID } from './creative-features';

export type RepurposeReelSpec = {
  hook: string;
  story: string;
  cta: string;
  overlayText?: string;
};

export type RepurposeStaticSpec = {
  headline: string;
  body: string;
  caption: string;
};

export type RepurposeCarouselBrief = {
  prompt: string;
  notes: string;
};

export type RepurposeSpec = {
  reel: RepurposeReelSpec;
  carousel: RepurposeCarouselBrief;
  static: RepurposeStaticSpec;
};

export type RepurposePlannerContext = {
  prompt: string;
  notes: string;
  brief?: LeadBrief;
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

function fallbackReel(prompt: string): RepurposeReelSpec {
  const hook = clampWords(prompt, HOOK_MAX_WORDS, 'Essa dor some hoje');
  return {
    hook,
    story: 'Mostre o que muda na prática agora',
    cta: 'Comenta EU QUERO',
    overlayText: 'Salve este Reel',
  };
}

function fallbackStatic(prompt: string): RepurposeStaticSpec {
  return {
    headline: clampWords(prompt, HEADLINE_MAX_WORDS, 'Essa frase precisa ser salva'),
    body: 'Uma linha de apoio, sem enrolação.',
    caption: withSaveOrCommentCta(prompt),
  };
}

export function parseRepurposeSpec(
  value: unknown,
  context: RepurposePlannerContext,
): RepurposeSpec {
  const raw = asRecord(value) || {};
  const reelRaw = asRecord(raw.reel) || {};
  const carouselRaw = asRecord(raw.carousel) || {};
  const staticRaw = asRecord(raw.static) || {};
  const reelFallback = fallbackReel(context.prompt);
  const staticFallback = fallbackStatic(context.prompt);
  const overlay = clampWords(text(reelRaw.overlayText), HOOK_MAX_WORDS);
  return {
    reel: {
      hook: clampWords(
        text(reelRaw.hook, reelFallback.hook),
        HOOK_MAX_WORDS,
        reelFallback.hook,
      ),
      story: clampWords(
        text(reelRaw.story, reelFallback.story),
        STORY_MAX_WORDS,
        reelFallback.story,
      ),
      cta: clampWords(
        text(reelRaw.cta, reelFallback.cta),
        CTA_MAX_WORDS,
        reelFallback.cta,
      ),
      ...(overlay ? { overlayText: overlay } : {}),
    },
    carousel: {
      prompt: text(carouselRaw.prompt, context.prompt).slice(0, 4000),
      notes: text(
        carouselRaw.notes,
        [context.notes, 'Capa = dor. Último slide = salve ou comenta X.']
          .filter(Boolean)
          .join('\n'),
      ).slice(0, 4000),
    },
    static: {
      headline: clampWords(
        text(staticRaw.headline, staticFallback.headline),
        HEADLINE_MAX_WORDS,
        staticFallback.headline,
      ),
      body: clampWords(
        text(staticRaw.body, staticFallback.body),
        BODY_MAX_WORDS,
        staticFallback.body,
      ),
      caption: withSaveOrCommentCta(
        text(staticRaw.caption, staticFallback.caption),
      ).slice(0, 2200),
    },
  };
}

function briefBlock(brief?: LeadBrief): string {
  if (!brief) return '(sem perfil)';
  return [
    `Nome: ${brief.name}`,
    `Categoria: ${brief.category || '—'}`,
    `Descrição: ${brief.description || '—'}`,
    `Serviços: ${(brief.services || []).join(', ') || '—'}`,
    brief.rating != null
      ? `Nota real: ${brief.rating}`
      : 'Não invente rating, resultado ou depoimento',
  ].join('\n');
}

export function buildRepurposePlannerPrompt(context: RepurposePlannerContext): string {
  return `Você é estrategista de conteúdo da Namão Criativa.
Reaproveite UM briefing em três formatos de Instagram.
Responda APENAS um JSON:
{
  "reel": {
    "hook": "até ${HOOK_MAX_WORDS} palavras",
    "story": "até ${STORY_MAX_WORDS} palavras",
    "cta": "até ${CTA_MAX_WORDS} palavras",
    "overlayText": "opcional, até ${HOOK_MAX_WORDS} palavras"
  },
  "carousel": {
    "prompt": "briefing do carrossel, capa = dor, 5 dicas, CTA de save ou comentário",
    "notes": "tom, paleta, palavra-chave do comentário"
  },
  "static": {
    "headline": "frase poderosa, até ${HEADLINE_MAX_WORDS} palavras",
    "body": "apoio curto ou vazio",
    "caption": "legenda com save ou comenta X"
  }
}

Regras:
- Reel cabe em 8s: hook 0–2s, história curta, CTA falado.
- Carrossel: capa = dor, meio = dicas aplicáveis, último = save ou comenta X.
- Estático: uma afirmação forte, sem parágrafo.
- Não invente número, depoimento, @, WhatsApp ou preço que o briefing não trouxe.
- Português do Brasil.

BRIEFING
${context.prompt.trim()}

NOTAS
${context.notes.trim() || '(nenhuma)'}

PERFIL
${briefBlock(context.brief)}
`;
}

export function buildStaticPostPrompt(spec: RepurposeStaticSpec): string {
  const quoted = (value: string) => `"${value.replace(/"/g, "'")}"`;
  return `Create a single Instagram feed post (portrait 4:5). Photorealistic graphic design, not a phone mockup.

LOCKED STRINGS — print these Brazilian Portuguese texts EXACTLY.
Headline: ${quoted(spec.headline)}
Body: ${spec.body ? quoted(spec.body) : '(no body text)'}

RULES
- Aspect 4:5, large type, high contrast, safe margins.
- One idea. No Instagram UI, no fake @handles, no watermarks, no QR.
- Feature ${STATIC_INSTAGRAM_ID}.
`;
}

export const STATIC_SYSTEM_INSTRUCTION = `You are Namão Criativa's in-house art generator for a single Instagram feed statement.
Always produce a 4:5 portrait graphic with large readable Brazilian Portuguese copy.
Print locked strings exactly. No Instagram UI, watermarks, fake handles, or QR codes.`;
