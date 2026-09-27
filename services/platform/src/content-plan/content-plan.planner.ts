import type { CalendarIdea, CalendarIdeaFormat } from '../calendar/calendar-ideas.planner';
import { CALENDAR_IDEA_FORMATS } from '../calendar/calendar-ideas.planner';
import {
  HOOK_MAX_WORDS,
  clampWords,
  withSaveOrCommentCta,
} from '../creative-studio/copy-limits';

export const CONTENT_PLAN_FORMATS = CALENDAR_IDEA_FORMATS;
export type ContentPlanFormat = CalendarIdeaFormat;

export const MIN_POSTS_PER_WEEK = 1;
export const MAX_POSTS_PER_WEEK = 7;
export const MIN_PLAN_WEEKS = 2;
export const MAX_PLAN_WEEKS = 8;

export type ContentPlanItem = {
  scheduledAt: string;
  title: string;
  hook: string;
  caption: string;
  format: ContentPlanFormat;
};

export type ContentPlanIgBrief = {
  overview: { who: string; sells: string; audience: string; stage: string };
  voice: { adjectives: string[]; quotes: string[] };
  pillars: string[];
  gaps: string[];
  plan: Array<{ week: string; mix: string; goal: string }>;
  ideas: CalendarIdea[];
};

export type ContentPlanPlannerContext = {
  title: string;
  description: string;
  postsPerWeek: number;
  weeks: number;
  formats: ContentPlanFormat[];
  dates: string[];
  report: ContentPlanIgBrief;
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

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean).slice(0, max);
}

export function clampPostsPerWeek(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.min(MAX_POSTS_PER_WEEK, Math.max(MIN_POSTS_PER_WEEK, Math.round(n)));
}

export function clampWeeks(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 4;
  return Math.min(MAX_PLAN_WEEKS, Math.max(MIN_PLAN_WEEKS, Math.round(n)));
}

export function parseFormats(value: unknown): ContentPlanFormat[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const next = raw
    .map((item) => text(item).toLowerCase())
    .filter((item): item is ContentPlanFormat =>
      (CONTENT_PLAN_FORMATS as readonly string[]).includes(item),
    );
  return [...new Set(next)];
}

export function weekdayOffsets(postsPerWeek: number): number[] {
  const n = clampPostsPerWeek(postsPerWeek);
  if (n === 1) return [0];
  if (n === 2) return [0, 3];
  if (n === 3) return [0, 2, 4];
  if (n === 4) return [0, 1, 3, 4];
  if (n === 5) return [0, 1, 2, 3, 4];
  if (n === 6) return [0, 1, 2, 3, 4, 5];
  return [0, 1, 2, 3, 4, 5, 6];
}

export function nextMonday(from = new Date()): Date {
  const date = new Date(from);
  date.setHours(10, 0, 0, 0);
  const mondayIndex = (date.getDay() + 6) % 7;
  const delta = mondayIndex === 0 ? 7 : 7 - mondayIndex;
  date.setDate(date.getDate() + delta);
  return date;
}

export function buildScheduleDates(
  postsPerWeek: number,
  weeks: number,
  from?: Date,
): Date[] {
  const perWeek = clampPostsPerWeek(postsPerWeek);
  const horizon = clampWeeks(weeks);
  const start = nextMonday(from);
  const offsets = weekdayOffsets(perWeek);
  const dates: Date[] = [];
  for (let week = 0; week < horizon; week += 1) {
    for (const offset of offsets) {
      const date = new Date(start);
      date.setDate(start.getDate() + week * 7 + offset);
      dates.push(date);
    }
  }
  return dates;
}

export function summarizeIgReport(raw: unknown): ContentPlanIgBrief | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const overview = asRecord(rec.overview) || {};
  const voice = asRecord(rec.voice) || {};
  const who = text(overview.who);
  if (!who) return null;
  const ideasRaw = Array.isArray(rec.ideas) ? rec.ideas : [];
  const ideas: CalendarIdea[] = ideasRaw.slice(0, 8).map((item, index) => {
    const row = asRecord(item) || {};
    const formatRaw = text(row.format, 'carousel').toLowerCase();
    const format = (CONTENT_PLAN_FORMATS as readonly string[]).includes(formatRaw)
      ? (formatRaw as ContentPlanFormat)
      : 'carousel';
    return {
      title: text(row.title, `Ideia ${index + 1}`),
      hook: text(row.hook, text(row.title, `Ideia ${index + 1}`)),
      caption: text(row.caption, text(row.hook)),
      format,
      ...(text(row.commentKeyword)
        ? { commentKeyword: text(row.commentKeyword) }
        : {}),
    };
  });
  const planRaw = Array.isArray(rec.plan) ? rec.plan : [];
  return {
    overview: {
      who,
      sells: text(overview.sells, who),
      audience: text(overview.audience, 'clientes locais'),
      stage: text(overview.stage, 'em construção'),
    },
    voice: {
      adjectives: stringList(voice.adjectives, 5),
      quotes: stringList(voice.quotes, 3),
    },
    pillars: stringList(rec.pillars, 6),
    gaps: stringList(rec.gaps, 6),
    plan: planRaw.slice(0, 4).map((item, index) => {
      const row = asRecord(item) || {};
      return {
        week: text(row.week, `Semana ${index + 1}`),
        mix: text(row.mix, 'Reel + estático'),
        goal: text(row.goal, 'Gerar conversa no Instagram'),
      };
    }),
    ideas,
  };
}

function parseFormat(
  value: unknown,
  allowed: ContentPlanFormat[],
  fallback: ContentPlanFormat,
): ContentPlanFormat {
  const raw = text(value).toLowerCase();
  if (allowed.includes(raw as ContentPlanFormat)) return raw as ContentPlanFormat;
  return fallback;
}

function fallbackItem(
  context: ContentPlanPlannerContext,
  index: number,
): ContentPlanItem {
  const idea = context.report.ideas[index % Math.max(1, context.report.ideas.length)];
  const format =
    context.formats[index % context.formats.length] || idea?.format || 'carousel';
  const hook = clampWords(
    idea?.hook || context.report.gaps[index % Math.max(1, context.report.gaps.length)] || context.report.overview.sells,
    HOOK_MAX_WORDS,
    context.report.overview.sells,
  );
  return {
    scheduledAt: context.dates[index],
    title: clampWords(idea?.title || hook, 8, hook).slice(0, 200),
    hook,
    caption: withSaveOrCommentCta(
      idea?.caption || `${hook}\n\n${context.report.overview.sells}`,
    ).slice(0, 2200),
    format,
  };
}

export function parseContentPlanSpec(
  value: unknown,
  context: ContentPlanPlannerContext,
): { items: ContentPlanItem[] } {
  const raw = asRecord(value) || {};
  const fromItems = Array.isArray(raw.items) ? raw.items : [];
  const items: ContentPlanItem[] = [];
  for (let i = 0; i < context.dates.length; i += 1) {
    const row = asRecord(fromItems[i]);
    const fallback = fallbackItem(context, i);
    items.push({
      scheduledAt: context.dates[i],
      title: clampWords(text(row?.title, fallback.title), 8, fallback.title).slice(
        0,
        200,
      ),
      hook: clampWords(text(row?.hook, fallback.hook), HOOK_MAX_WORDS, fallback.hook),
      caption: withSaveOrCommentCta(text(row?.caption, fallback.caption)).slice(
        0,
        2200,
      ),
      format: parseFormat(row?.format, context.formats, fallback.format),
    });
  }
  return { items };
}

export function buildContentPlanPrompt(context: ContentPlanPlannerContext): string {
  const formats = context.formats.join('|');
  return `Você é estrategista de conteúdo da Namão Criativa.
Monte um plano de postagem para o Instagram deste negócio.
Responda APENAS um JSON com este shape:
{
  "items": [
    {
      "title": "até 8 palavras",
      "hook": "até 10 palavras",
      "caption": "legenda com save ou comenta X",
      "format": "${formats}"
    }
  ]
}

Regras:
- Exatamente ${context.dates.length} items, na ordem das datas (a API aplica as datas).
- Use só os formatos: ${context.formats.join(', ')}.
- Português do Brasil. Title até 8 palavras. Hook até ${HOOK_MAX_WORDS} palavras.
- Varie pilares e cubra os gaps do relatório Instagram. Sem clichê de "empreendedor".
- Não invente rating, resultado, preço, WhatsApp, @ ou depoimento que o relatório não trouxe.
- Se faltar dado, fale da dor — não invente número.

TÍTULO DO PLANO
${context.title}

BRIEF DO PLANO
${context.description.trim() || '(nenhum brief extra)'}

CADÊNCIA
${context.postsPerWeek} posts/semana · ${context.weeks} semanas · ${context.dates.length} peças

RELATÓRIO DA SKILL INSTAGRAM (fonte obrigatória)
${JSON.stringify({
    overview: context.report.overview,
    voice: context.report.voice,
    pillars: context.report.pillars,
    gaps: context.report.gaps,
    plan: context.report.plan,
    ideas: context.report.ideas,
  })}
`;
}
