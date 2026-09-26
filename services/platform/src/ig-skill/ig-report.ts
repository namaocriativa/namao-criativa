import type { LeadBrief } from '../owner/lead-brief';
import {
  parseCalendarIdeasSpec,
  type CalendarIdea,
} from '../calendar/calendar-ideas.planner';
import type { IgCorpus } from './ig-corpus';

export type IgSkillReport = {
  overview: {
    who: string;
    sells: string;
    audience: string;
    stage: string;
  };
  voice: {
    adjectives: string[];
    quotes: string[];
  };
  pillars: string[];
  gaps: string[];
  plan: Array<{ week: string; mix: string; goal: string }>;
  ideas: CalendarIdea[];
  corpus: IgCorpus;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = ''): string {
  return String(value ?? '').trim() || fallback;
}

function stringList(value: unknown, fallback: string[], max: number): string[] {
  const raw = Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
  const next = raw.length ? raw : fallback;
  return next.slice(0, max);
}

export function parseIgReport(
  value: unknown,
  ctx: { brief: LeadBrief; notes: string; corpus: IgCorpus },
): IgSkillReport {
  const raw = asRecord(value) || {};
  const overviewRaw = asRecord(raw.overview) || {};
  const voiceRaw = asRecord(raw.voice) || {};
  const ideas = parseCalendarIdeasSpec(
    { ideas: raw.ideas },
    { brief: ctx.brief, notes: ctx.notes },
  ).ideas;
  const planRaw = Array.isArray(raw.plan) ? raw.plan : [];
  const plan = [0, 1, 2, 3].map((index) => {
    const item = asRecord(planRaw[index]);
    return {
      week: text(item?.week, `Semana ${index + 1}`),
      mix: text(item?.mix, 'Reel + estático'),
      goal: text(item?.goal, 'Gerar conversa no Instagram'),
    };
  }).slice(0, Math.min(4, Math.max(2, planRaw.length || 2)));

  return {
    overview: {
      who: text(overviewRaw.who, ctx.brief.name),
      sells: text(
        overviewRaw.sells,
        ctx.brief.category || (ctx.brief.services || []).join(', ') || ctx.brief.name,
      ),
      audience: text(overviewRaw.audience, ctx.brief.city || 'clientes locais'),
      stage: text(overviewRaw.stage, ctx.corpus.postCount ? 'em construção' : 'perfil vazio'),
    },
    voice: {
      adjectives: stringList(voiceRaw.adjectives, ['direto', 'local'], 5),
      quotes: stringList(
        voiceRaw.quotes,
        ctx.corpus.posts.map((post) => post.captionPreview).filter(Boolean).slice(0, 3),
        3,
      ),
    },
    pillars: stringList(
      raw.pillars,
      ctx.corpus.themes.slice(0, 4).map((item) => item.tag),
      6,
    ),
    gaps: stringList(raw.gaps, ['prova social', 'oferta clara'], 6),
    plan,
    ideas,
    corpus: ctx.corpus,
  };
}

export function buildIgPlanPrompt(ctx: {
  brief: LeadBrief;
  notes: string;
  corpus: IgCorpus;
}): string {
  return `Você é estrategista de conteúdo da Namão Criativa.
Analise o FEED REAL deste Instagram (já compactado). Não invente métricas: sem seguidores, views, likes, alcance ou "o Reel bombou".
Responda APENAS JSON:
{
  "overview": { "who": "", "sells": "", "audience": "", "stage": "amador|em construção|marca" },
  "voice": { "adjectives": ["", ""], "quotes": ["frase citada do feed", ""] },
  "pillars": ["tema"],
  "gaps": ["o que o feed não cobre"],
  "plan": [
    { "week": "Semana 1", "mix": "2 Reels + 1 carrossel", "goal": "" }
  ],
  "ideas": [
    {
      "title": "até 8 palavras",
      "hook": "até 10 palavras",
      "caption": "legenda com save ou comenta X",
      "format": "carousel|reel|static",
      "commentKeyword": "PALAVRA"
    }
  ]
}

Regras:
- quotes: até 3 frases copiadas (ou quase) das captions. Sem inventar.
- Exatamente 5 ideas no shape do calendário. Português do Brasil.
- 2 a 4 semanas no plan.
- Use só brief + corpus. Se faltar dado, diga que falta — não invente WhatsApp, preço ou depoimento.

BRIEF
${JSON.stringify({
    name: ctx.brief.name,
    category: ctx.brief.category,
    city: ctx.brief.city,
    state: ctx.brief.state,
    services: ctx.brief.services,
    description: ctx.brief.description,
    instagram: ctx.brief.contacts.instagram,
  })}

CORPUS FACTUAL (já medido; não contradiga)
${JSON.stringify(ctx.corpus)}

NOTAS DO OPERADOR
${ctx.notes.trim() || '(nenhuma)'}
`;
}
