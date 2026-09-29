import type { CalendarIdea, CalendarIdeaFormat } from '../calendar/calendar-ideas.planner';
import { CALENDAR_IDEA_FORMATS } from '../calendar/calendar-ideas.planner';
import {
  HOOK_MAX_WORDS,
  clampWords,
  withSaveOrCommentCta,
} from '../creative-studio/copy-limits';
import {
  CONTENT_PLAN_JOURNEY,
  CONTENT_PLAN_OBJECTIVE_LABELS,
  CONTENT_PLAN_TONE_LABELS,
  clampVideoTakeCount,
  parseJourney,
  parseVideoTakes,
  suggestTonesFromVoice,
  type ContentPlanClientContext,
  type ContentPlanContextOverrides,
  type ContentPlanFormBrief,
  type ContentPlanItem,
  type ContentPlanJourney,
  type ContentPlanMixMode,
  type ContentPlanObjective,
  type ContentPlanStrategy,
  type ContentPlanTone,
} from './content-plan.contract';

export const CONTENT_PLAN_FORMATS = CALENDAR_IDEA_FORMATS;
export type ContentPlanFormat = CalendarIdeaFormat;

export const MIN_POSTS_PER_WEEK = 1;
export const MAX_POSTS_PER_WEEK = 7;
export const MIN_PLAN_WEEKS = 2;
export const MAX_PLAN_WEEKS = 8;

export type {
  ContentPlanClientContext,
  ContentPlanFormBrief,
  ContentPlanItem,
  ContentPlanStrategy,
};

export type ContentPlanIgBrief = {
  overview: { who: string; sells: string; audience: string; stage: string };
  voice: { adjectives: string[]; quotes: string[] };
  pillars: string[];
  gaps: string[];
  plan: Array<{ week: string; mix: string; goal: string }>;
  ideas: CalendarIdea[];
  corpus: {
    username: string | null;
    windowDays: number;
    postCount: number;
    postsPerWeek: number;
    mix: { image: number; video: number; carousel: number; other: number };
    themes: string[];
    hashtags: string[];
    ctas: { whatsapp: number; link: number; comment: number; save: number };
    weekGaps: string[];
  } | null;
};

export type ContentPlanLeadSlice = {
  name: string;
  category: string | null;
  city: string | null;
  services: string[];
};

export type ContentPlanPlannerContext = {
  title: string;
  description: string;
  postsPerWeek: number;
  weeks: number;
  formats: ContentPlanFormat[];
  formatMix: ContentPlanMixMode;
  dates: string[];
  report: ContentPlanIgBrief;
  lead: ContentPlanLeadSlice;
  objectives: ContentPlanObjective[];
  goalNote: string;
  tones: ContentPlanTone[];
  promote: string;
  avoid: string;
  overrides: ContentPlanContextOverrides;
  previousPlan?: { title: string; strategy?: ContentPlanStrategy | null } | null;
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

export function parseStartsOn(value?: string | null): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const day = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (day) {
    const date = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 10, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(10, 0, 0, 0);
  return date;
}

export function resolvePlanStart(startsOn?: string | null, from = new Date()): Date {
  return parseStartsOn(startsOn) || nextMonday(from);
}

export function buildScheduleDates(
  postsPerWeek: number,
  weeks: number,
  from?: Date,
): Date[] {
  const perWeek = clampPostsPerWeek(postsPerWeek);
  const horizon = clampWeeks(weeks);
  const start = from ? new Date(from) : nextMonday();
  start.setHours(10, 0, 0, 0);
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

function summarizeCorpus(raw: unknown): ContentPlanIgBrief['corpus'] {
  const rec = asRecord(raw);
  if (!rec) return null;
  const mix = asRecord(rec.mix) || {};
  const ctas = asRecord(rec.ctas) || {};
  return {
    username: text(rec.username) || null,
    windowDays: Number(rec.windowDays) || 30,
    postCount: Number(rec.postCount) || 0,
    postsPerWeek: Number(rec.postsPerWeek) || 0,
    mix: {
      image: Number(mix.image) || 0,
      video: Number(mix.video) || 0,
      carousel: Number(mix.carousel) || 0,
      other: Number(mix.other) || 0,
    },
    themes: stringList(
      Array.isArray(rec.themes)
        ? rec.themes.map((item) => asRecord(item)?.tag ?? item)
        : [],
      8,
    ),
    hashtags: stringList(
      Array.isArray(rec.hashtags)
        ? rec.hashtags.map((item) => asRecord(item)?.tag ?? item)
        : [],
      8,
    ),
    ctas: {
      whatsapp: Number(ctas.whatsapp) || 0,
      link: Number(ctas.link) || 0,
      comment: Number(ctas.comment) || 0,
      save: Number(ctas.save) || 0,
    },
    weekGaps: stringList(rec.gaps, 8),
  };
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
    corpus: summarizeCorpus(rec.corpus),
  };
}

function presentCtas(ctas: NonNullable<ContentPlanIgBrief['corpus']>['ctas']): string[] {
  const labels: string[] = [];
  if (ctas.whatsapp) labels.push('WhatsApp');
  if (ctas.link) labels.push('link');
  if (ctas.comment) labels.push('comentário');
  if (ctas.save) labels.push('salvar');
  return labels;
}

export function buildClientContext(opts: {
  igJobId: string;
  analyzedAt?: Date | string | null;
  report: ContentPlanIgBrief;
  lead?: ContentPlanLeadSlice | null;
}): ContentPlanClientContext {
  const corpus = opts.report.corpus;
  const lead = opts.lead || {
    name: opts.report.overview.who,
    category: null,
    city: null,
    services: [],
  };
  const analyzedAt =
    opts.analyzedAt instanceof Date
      ? opts.analyzedAt.toISOString()
      : text(opts.analyzedAt) || null;
  return {
    username: corpus?.username || null,
    analyzedAt,
    igJobId: opts.igJobId,
    identified: {
      postCount: corpus?.postCount || 0,
      postsPerWeek: corpus?.postsPerWeek || 0,
      windowDays: corpus?.windowDays || 30,
      mix: corpus?.mix || { image: 0, video: 0, carousel: 0, other: 0 },
      themes: corpus?.themes || [],
      hashtags: corpus?.hashtags || [],
      ctas: corpus ? presentCtas(corpus.ctas) : [],
    },
    inferred: {
      segment: opts.report.overview.sells,
      audience: opts.report.overview.audience,
      voice: opts.report.voice.adjectives,
      pillars: opts.report.pillars,
      gaps: opts.report.gaps,
      stage: opts.report.overview.stage,
    },
    suggestedTones: suggestTonesFromVoice(opts.report.voice.adjectives),
    lead: {
      name: lead.name,
      category: lead.category,
      city: lead.city,
      services: lead.services,
    },
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

function structureOf(
  value: unknown,
  format: ContentPlanFormat,
  hook: string,
): string[] {
  const list = stringList(value, 6);
  if (list.length) return list;
  if (format === 'carousel') {
    return [
      `Capa com a pergunta: ${hook}`,
      'Três pontos que respondem a dúvida',
      'Explicação curta de cada ponto',
      'Encerramento com convite a falar com o profissional',
    ];
  }
  if (format === 'reel') {
    return [
      `Gancho nos 2 primeiros segundos: ${hook}`,
      'Desenvolvimento em uma cena',
      'CTA falado no fechamento',
    ];
  }
  return [`Cena única com ${hook}`, 'Texto de apoio curto', 'CTA visível'];
}

function fallbackStrategy(context: ContentPlanPlannerContext): ContentPlanStrategy {
  const current = context.overrides.audience || context.report.overview.audience;
  const pillars = (context.report.pillars.length
    ? context.report.pillars
    : ['educação', 'autoridade', 'prova social', 'conversão']
  ).slice(0, 4);
  const objectiveLabels = context.objectives.map(
    (item) => CONTENT_PLAN_OBJECTIVE_LABELS[item],
  );
  return {
    summary: `${context.report.overview.who} quer ${
      objectiveLabels.join(', ') || 'crescer no Instagram'
    } sem perder a voz ${context.report.voice.adjectives.join(', ') || 'atual'}.`,
    objectives: objectiveLabels,
    audience: {
      current,
      intended: current,
    },
    pillars: pillars.map((name, index) => ({
      name,
      role:
        index === pillars.length - 1
          ? 'Fechar o convite'
          : 'Avançar a jornada da semana',
    })),
    messages: context.report.gaps.slice(0, 3).map((gap) => `Cobrir ${gap}`),
    mix: context.formats.join(' + '),
    sequence:
      'Cada semana apresenta um problema, explica o caminho, responde uma dúvida e convida ao próximo passo.',
    goals: context.goalNote
      ? [{ label: 'Meta do cliente', note: context.goalNote }]
      : [
          {
            label: 'Acompanhar conversa',
            note: 'Mensagens e salvamentos — sem número inventado.',
          },
        ],
  };
}

function fallbackItem(context: ContentPlanPlannerContext, index: number): ContentPlanItem {
  const idea = context.report.ideas[index % Math.max(1, context.report.ideas.length)];
  const format =
    context.formatMix === 'balanced'
      ? context.formats[index % context.formats.length] || 'carousel'
      : context.formats[index % context.formats.length] || idea?.format || 'carousel';
  const hook = clampWords(
    idea?.hook ||
      context.report.gaps[index % Math.max(1, context.report.gaps.length)] ||
      context.report.overview.sells,
    HOOK_MAX_WORDS,
    context.report.overview.sells,
  );
  const journey = CONTENT_PLAN_JOURNEY[index % CONTENT_PLAN_JOURNEY.length];
  const pillar =
    context.report.pillars[index % Math.max(1, context.report.pillars.length)] ||
    'autoridade';
  const objective =
    CONTENT_PLAN_OBJECTIVE_LABELS[
      context.objectives[index % Math.max(1, context.objectives.length)]
    ] || 'Fortalecer a marca';
  return {
    id: `cp-${index + 1}`,
    week: Math.floor(index / context.postsPerWeek) + 1,
    scheduledAt: context.dates[index],
    format,
    objective,
    pillar,
    journeyStage: journey,
    title: clampWords(idea?.title || hook, 8, hook).slice(0, 200),
    hook,
    caption: withSaveOrCommentCta(
      idea?.caption || `${hook}\n\n${context.report.overview.sells}`,
    ).slice(0, 2200),
    structure: structureOf(null, format, hook),
    visualDirection: `Identidade de ${context.report.overview.who}, fotos reais, composição limpa.`,
    cta: 'Salve este post ou chame no Direct.',
    status: 'draft',
  };
}

function parsePillars(
  value: unknown,
  fallback: ContentPlanStrategy['pillars'],
): ContentPlanStrategy['pillars'] {
  if (!Array.isArray(value) || !value.length) return fallback;
  return value.slice(0, 6).map((item, index) => {
    if (typeof item === 'string') {
      return { name: text(item, fallback[index]?.name || `Pilar ${index + 1}`), role: 'Avançar a jornada' };
    }
    const row = asRecord(item) || {};
    return {
      name: text(row.name, fallback[index]?.name || `Pilar ${index + 1}`),
      role: text(row.role, fallback[index]?.role || 'Avançar a jornada'),
    };
  });
}

function parseGoals(
  value: unknown,
  fallback: ContentPlanStrategy['goals'],
): ContentPlanStrategy['goals'] {
  if (!Array.isArray(value) || !value.length) return fallback;
  return value.slice(0, 4).map((item, index) => {
    const row = asRecord(item) || {};
    return {
      label: text(row.label, fallback[index]?.label || `Indicador ${index + 1}`),
      note: text(row.note, fallback[index]?.note || 'Qualitativo — sem número inventado.'),
    };
  });
}

export function parseContentPlanSpec(
  value: unknown,
  context: ContentPlanPlannerContext,
): { strategy: ContentPlanStrategy; items: ContentPlanItem[] } {
  const raw = asRecord(value) || {};
  const fallback = fallbackStrategy(context);
  const strategyRaw = asRecord(raw.strategy) || {};
  const audienceRaw = asRecord(strategyRaw.audience) || {};
  const strategy: ContentPlanStrategy = {
    summary: text(strategyRaw.summary, fallback.summary),
    objectives: stringList(strategyRaw.objectives, 3).length
      ? stringList(strategyRaw.objectives, 3)
      : fallback.objectives,
    audience: {
      current: text(audienceRaw.current, fallback.audience.current),
      intended: text(audienceRaw.intended, fallback.audience.intended),
    },
    pillars: parsePillars(strategyRaw.pillars, fallback.pillars),
    messages: stringList(strategyRaw.messages, 5).length
      ? stringList(strategyRaw.messages, 5)
      : fallback.messages,
    mix: text(strategyRaw.mix, fallback.mix),
    sequence: text(strategyRaw.sequence, fallback.sequence),
    goals: parseGoals(strategyRaw.goals, fallback.goals),
  };
  const fromItems = Array.isArray(raw.items) ? raw.items : [];
  const items: ContentPlanItem[] = [];
  for (let i = 0; i < context.dates.length; i += 1) {
    const row = asRecord(fromItems[i]);
    const base = fallbackItem(context, i);
    const format =
      context.formatMix === 'balanced'
        ? base.format
        : parseFormat(row?.format, context.formats, base.format);
    const hook = clampWords(text(row?.hook, base.hook), HOOK_MAX_WORDS, base.hook);
    items.push({
      id: text(row?.id, base.id) || base.id,
      week: Number(row?.week) > 0 ? Math.round(Number(row?.week)) : base.week,
      scheduledAt: context.dates[i],
      format,
      objective: text(row?.objective, base.objective),
      pillar: text(row?.pillar, base.pillar),
      journeyStage: parseJourney(row?.journeyStage, base.journeyStage),
      title: clampWords(text(row?.title, base.title), 8, base.title).slice(0, 200),
      hook,
      caption: withSaveOrCommentCta(text(row?.caption, base.caption)).slice(0, 2200),
      structure: structureOf(row?.structure, format, hook),
      visualDirection: text(row?.visualDirection, base.visualDirection),
      cta: text(row?.cta, base.cta),
      status: 'draft',
    });
  }
  return { strategy, items };
}

export function buildFormBrief(input: {
  title: string;
  objectives: ContentPlanObjective[];
  goalNote: string;
  tones: ContentPlanTone[];
  promote: string;
  avoid: string;
  formatMix: ContentPlanMixMode;
  startsOn: string;
  overrides: ContentPlanContextOverrides;
  usePreviousPlan: boolean;
}): ContentPlanFormBrief {
  return {
    title: input.title,
    objectives: input.objectives,
    goalNote: input.goalNote,
    tones: input.tones,
    promote: input.promote,
    avoid: input.avoid,
    formatMix: input.formatMix,
    startsOn: input.startsOn,
    contextOverrides: input.overrides,
    usePreviousPlan: input.usePreviousPlan,
  };
}

export function buildContentPlanPrompt(context: ContentPlanPlannerContext): string {
  const formats = context.formats.join('|');
  const journey = CONTENT_PLAN_JOURNEY.join('|');
  const objectiveLabels = context.objectives.map(
    (item) => CONTENT_PLAN_OBJECTIVE_LABELS[item],
  );
  const toneLabels = context.tones.map((item) => CONTENT_PLAN_TONE_LABELS[item]);
  const segment =
    context.overrides.segment || context.report.overview.sells;
  const audience =
    context.overrides.audience || context.report.overview.audience;
  const voice =
    context.overrides.voice || context.report.voice.adjectives.join(', ');
  return `Você é estrategista de conteúdo da Namão Criativa.
Não peça o que postar: parta do diagnóstico do perfil e do destino que o cliente escolheu.
Elabore uma estratégia e um calendário em que CADA publicação tem uma função na sequência (problema → explicação → dúvida → convite). Não solte ideias aleatórias.
Responda APENAS um JSON com este shape:
{
  "strategy": {
    "summary": "1-2 frases",
    "objectives": ["rótulo"],
    "audience": { "current": "seguidores de hoje", "intended": "público pretendido" },
    "pillars": [{ "name": "pilar", "role": "função na jornada" }],
    "messages": ["mensagem-chave"],
    "mix": "como os formatos se distribuem",
    "sequence": "como as semanas se encadeiam",
    "goals": [{ "label": "indicador qualitativo", "note": "como acompanhar, sem número inventado" }]
  },
  "items": [
    {
      "title": "até 8 palavras",
      "hook": "até 10 palavras",
      "caption": "legenda com save ou comenta X",
      "format": "${formats}",
      "objective": "objetivo desta peça",
      "pillar": "pilar",
      "journeyStage": "${journey}",
      "structure": ["passo 1", "passo 2"],
      "visualDirection": "descrição criativa independente de modelo",
      "cta": "convite concreto"
    }
  ]
}

Regras:
- Exatamente ${context.dates.length} items, na ordem das datas (a API aplica as datas).
- Use só os formatos: ${context.formats.join(', ')}. Mix: ${context.formatMix === 'balanced' ? 'distribua os formatos de forma equilibrada' : 'escolha o formato que melhor cumpre a função de cada peça'}.
- Português do Brasil. Title até 8 palavras. Hook até ${HOOK_MAX_WORDS} palavras.
- Distinga o público atual (seguidores) do público pretendido. Não os trate como a mesma coisa se o diagnóstico sugerir diferença.
- visualDirection é prosa (luz, composição, referências do feed). NÃO gere prompt de Imagen, Veo ou outro modelo.
- structure descreve slides (carrossel) ou cenas (reel/estático).
- journeyStage deve avançar a jornada ao longo da semana, não repetir "educate" em todas as peças.
- Não invente rating, resultado, preço, WhatsApp, @, meta numérica ou depoimento que o contexto não trouxe.
- Metas em strategy.goals são qualitativas. Se o cliente descreveu uma meta, use-a; senão, descreva o que observar — nunca prometa 20 mensagens, 1k seguidores etc.
- Se faltar dado, fale da dor — não invente número.

TÍTULO DO PLANO
${context.title}

OBJETIVOS (máx. 3)
${objectiveLabels.join(', ') || '(não informados)'}

META DO CLIENTE
${context.goalNote.trim() || '(nenhuma meta numérica; não invente)'}

TOM
${toneLabels.join(', ') || '(manter a voz do feed)'}

PROMOVER
${context.promote.trim() || '(nada extra)'}

EVITAR
${context.avoid.trim() || '(nada extra)'}

CADÊNCIA
${context.postsPerWeek} posts/semana · ${context.weeks} semanas · ${context.dates.length} peças

PERFIL (ficha)
${JSON.stringify(context.lead)}

CORREÇÕES DO OPERADOR (prevalecem sobre o inferido)
${JSON.stringify({
    segment,
    audience,
    voice,
  })}

DIAGNÓSTICO INSTAGRAM — IDENTIFICADO (corpus do feed, não invente em cima)
${JSON.stringify(context.report.corpus)}

DIAGNÓSTICO INSTAGRAM — INFERIDO (IA; o operador pode ter corrigido acima)
${JSON.stringify({
    overview: context.report.overview,
    voice: context.report.voice,
    pillars: context.report.pillars,
    gaps: context.report.gaps,
    plan: context.report.plan,
    ideas: context.report.ideas,
  })}
${
  context.previousPlan
    ? `
PLANO ANTERIOR (referência; continue a narrativa, não copie as peças)
${JSON.stringify({
        title: context.previousPlan.title,
        strategy: context.previousPlan.strategy,
      })}
`
    : ''
}
`;
}

export function buildItemRewritePrompt(
  item: ContentPlanItem,
  note: string,
  videoHook?: {
    title: string;
    summary: string;
    prompt: string;
    example?: string;
  } | null,
): string {
  const structureKind =
    item.format === 'carousel'
      ? 'slides do carrossel'
      : item.format === 'reel'
        ? 'cenas do reel 9:16'
        : 'cenas do estático 4:5';
  const hookBlock = videoHook
    ? `
HOOK VISUAL (linguagem de câmera e mundo, NÃO uma cena travada)
${videoHook.title} — ${videoHook.summary}
${videoHook.example ? `Exemplo canônico (ilustra energia; NÃO copiar como prop obrigatório): ${videoHook.example}` : ''}
Reescreva as cenas da structure no ASSUNTO da peça, usando essa linguagem (lente, físico, paleta, mundo). Só use cadeira, avião, tubo neon etc. se o pedido do operador ou a peça pedirem. Não copie o prompt em inglês no hook textual de até ${HOOK_MAX_WORDS} palavras. Se houver personagem, ele é quem vive nesse visual.
Prompt de estilo (não reproduzir no JSON):
${videoHook.prompt}
`
    : '';
  return `Você reescreve o roteiro de UMA peça de Instagram.
Mantenha o formato ${item.format} e a função da peça na jornada.
Aplique o pedido do operador. Não invente números, WhatsApp, @ ou depoimento.
Português do Brasil. Title até 8 palavras. Hook até ${HOOK_MAX_WORDS} palavras.
visualDirection em prosa (luz, composição, referências). NÃO gere prompt de modelo.
structure descreve ${structureKind}.
Responda APENAS um JSON:
{
  "title": "até 8 palavras",
  "hook": "até ${HOOK_MAX_WORDS} palavras",
  "caption": "legenda com save ou comenta X",
  "structure": ["passo 1", "passo 2"],
  "visualDirection": "descrição criativa independente de modelo",
  "cta": "convite concreto"
}
${hookBlock}
PEÇA ATUAL
${JSON.stringify({
    format: item.format,
    title: item.title,
    hook: item.hook,
    caption: item.caption,
    structure: item.structure,
    visualDirection: item.visualDirection,
    cta: item.cta,
    objective: item.objective,
    pillar: item.pillar,
    journeyStage: item.journeyStage,
  })}

O QUE MUDAR
${note.trim()}
`;
}

export function applyItemRewrite(
  item: ContentPlanItem,
  value: unknown,
): ContentPlanItem {
  const row = asRecord(value) || {};
  const hook = clampWords(text(row.hook, item.hook), HOOK_MAX_WORDS, item.hook);
  return {
    ...item,
    title: clampWords(text(row.title, item.title), 8, item.title).slice(0, 200),
    hook,
    caption: withSaveOrCommentCta(text(row.caption, item.caption)).slice(0, 2200),
    structure: structureOf(row.structure, item.format, hook),
    visualDirection: text(row.visualDirection, item.visualDirection),
    cta: text(row.cta, item.cta),
  };
}

export function buildBreakVideoTakesPrompt(
  item: ContentPlanItem,
  takeCount: number,
  videoHook?: {
    title: string;
    summary: string;
    prompt: string;
    example?: string;
  } | null,
): string {
  const count = clampVideoTakeCount(takeCount);
  const hookBlock = videoHook
    ? `
HOOK VISUAL (linguagem de câmera e mundo, NÃO uma cena travada)
${videoHook.title} — ${videoHook.summary}
${videoHook.example ? `Exemplo canônico (ilustra energia; NÃO copiar como prop obrigatório): ${videoHook.example}` : ''}
Aplique essa linguagem em CADA take. Não force props do exemplo. Se houver personagem, ele vive em todas as takes.
Prompt de estilo (não colar no productionPrompt):
${videoHook.prompt}
`
    : '';
  return `Você parte UM roteiro de Reel 9:16 em EXATAMENTE ${count} takes de vídeo.
Cada take dura ~8 a 10 segundos e precisa funcionar sozinha (início, meio, fim claros).
Arco contínuo: take 1 prende (hook), takes do meio desenvolvem, a última fecha com CTA.
Não repita o mesmo gag nem a mesma ação em takes diferentes.
Português do Brasil. Não invente WhatsApp, @, números ou depoimento.
productionPrompt é o briefing concreto enviado ao modelo de vídeo (câmera, ação, texto falado se houver, ritmo). Máximo ~80 palavras por take.
label curto (ex.: "Take 1 · Hook"). beat = uma frase do que acontece.
Responda APENAS um JSON:
{
  "takes": [
    {
      "id": "take-1",
      "label": "Take 1 · Hook",
      "beat": "o que acontece neste clip",
      "productionPrompt": "briefing de geração do clip"
    }
  ]
}
${hookBlock}
PEÇA
${JSON.stringify({
    title: item.title,
    hook: item.hook,
    caption: item.caption,
    structure: item.structure,
    visualDirection: item.visualDirection,
    cta: item.cta,
    objective: item.objective,
    pillar: item.pillar,
    journeyStage: item.journeyStage,
  })}

QUANTIDADE OBRIGATÓRIA DE TAKES: ${count}
`;
}

export function applyBreakVideoTakes(
  item: ContentPlanItem,
  value: unknown,
  takeCount: number,
): ContentPlanItem {
  const count = clampVideoTakeCount(takeCount);
  const row = asRecord(value) || {};
  const rawTakes = Array.isArray(row.takes) ? row.takes : Array.isArray(value) ? value : [];
  const normalized = rawTakes
    .map((entry, index) => {
      const take = asRecord(entry) || {};
      return {
        id: text(take.id, `take-${index + 1}`).slice(0, 64) || `take-${index + 1}`,
        label: text(take.label, `Take ${index + 1}`).slice(0, 120) || `Take ${index + 1}`,
        beat: text(take.beat).slice(0, 400),
        productionPrompt: text(take.productionPrompt || take.prompt).slice(0, 4000),
      };
    })
    .filter((take) => take.beat && take.productionPrompt)
    .slice(0, count);
  while (normalized.length < count) {
    const index = normalized.length;
    const fallbackBeat =
      item.structure[index] ||
      (index === 0
        ? `Gancho: ${item.hook || item.title}`
        : index === count - 1
          ? `CTA: ${item.cta || 'Convide a salvar'}`
          : `Desenvolvimento ${index}`);
    normalized.push({
      id: `take-${index + 1}`,
      label: index === 0 ? 'Take 1 · Hook' : index === count - 1 ? `Take ${count} · CTA` : `Take ${index + 1}`,
      beat: fallbackBeat,
      productionPrompt: [
        item.title ? `Título: ${item.title}` : '',
        fallbackBeat,
        item.visualDirection ? `Direção: ${item.visualDirection}` : '',
        'Clip de 8 a 10 segundos, vertical 9:16.',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }
  const videoTakes = parseVideoTakes(normalized);
  const rest = { ...item };
  delete rest.videoTakes;
  return {
    ...rest,
    structure: videoTakes.map((take) => take.beat),
    ...(videoTakes.length ? { videoTakes } : {}),
  };
}

export {
  defaultPlanTitle,
  parseMixMode,
  parseObjectives,
  parseTones,
} from './content-plan.contract';

export {
  CONTENT_PLAN_OBJECTIVE_LABELS,
  CONTENT_PLAN_TONE_LABELS,
};
