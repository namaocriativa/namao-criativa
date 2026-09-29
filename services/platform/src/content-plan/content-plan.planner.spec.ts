import {
  applyBreakVideoTakes,
  applyItemRewrite,
  buildBreakVideoTakesPrompt,
  buildClientContext,
  buildContentPlanPrompt,
  buildItemRewritePrompt,
  buildScheduleDates,
  nextMonday,
  parseContentPlanSpec,
  summarizeIgReport,
  weekdayOffsets,
} from './content-plan.planner';

const report = {
  overview: {
    who: 'Studio Ana',
    sells: 'Cortes e coloração',
    audience: 'Mulheres em Curitiba',
    stage: 'em construção',
  },
  voice: { adjectives: ['direto', 'local'], quotes: ['Agenda aberta na terça'] },
  pillars: ['antes e depois', 'rotina'],
  gaps: ['prova social', 'oferta clara'],
  plan: [{ week: 'Semana 1', mix: '2 Reels + 1 carrossel', goal: 'Salvar' }],
  ideas: [
    {
      title: 'Agenda vazia',
      hook: 'Sua terça está vazia?',
      caption: 'Salve este post',
      format: 'carousel' as const,
    },
  ],
  corpus: {
    username: 'studio.ana',
    windowDays: 30,
    postCount: 12,
    postsPerWeek: 2,
    mix: { image: 6, video: 4, carousel: 2, other: 0 },
    themes: ['cabelo', 'agenda'],
    hashtags: ['curitiba'],
    ctas: { whatsapp: 1, link: 0, comment: 2, save: 0 },
    weekGaps: ['2026-W36'],
  },
};

const plannerContext = {
  title: 'Setembro firme',
  description: 'Tom direto. Foco em agenda.',
  postsPerWeek: 2,
  weeks: 1,
  formats: ['carousel', 'reel'] as Array<'carousel' | 'reel'>,
  formatMix: 'ai' as const,
  dates: ['2026-09-28T13:00:00.000Z', '2026-09-30T13:00:00.000Z'],
  report,
  lead: { name: 'Studio Ana', category: 'salão', city: 'Curitiba', services: ['corte'] },
  objectives: ['leads' as const, 'brand' as const],
  goalNote: '',
  tones: ['close' as const, 'professional' as const],
  promote: 'Agenda da terça',
  avoid: 'Clichê de empreendedor',
  overrides: {},
};

describe('content-plan.planner', () => {
  it('espalha 3 posts na semana em seg, qua e sex', () => {
    expect(weekdayOffsets(3)).toEqual([0, 2, 4]);
    const monday = nextMonday(new Date('2026-09-22T15:00:00.000Z'));
    expect(monday.getDay()).toBe(1);
    const dates = buildScheduleDates(3, 2, monday);
    expect(dates).toHaveLength(6);
    expect(dates[0].getDay()).toBe(1);
    expect(dates[1].getDay()).toBe(3);
    expect(dates[2].getDay()).toBe(5);
    expect(dates[3].getTime() - dates[0].getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('monta o prompt com diagnóstico, objetivos e corpus', () => {
    const prompt = buildContentPlanPrompt(plannerContext);
    expect(prompt).toContain('Studio Ana');
    expect(prompt).toContain('antes e depois');
    expect(prompt).toContain('prova social');
    expect(prompt).toContain('Setembro firme');
    expect(prompt).toContain('carousel|reel');
    expect(prompt).toContain('não invente');
    expect(prompt).toContain('studio.ana');
    expect(prompt).toContain('Gerar leads');
    expect(prompt).toContain('IDENTIFICADO');
  });

  it('completa N itens com briefing, só nos formatos pedidos', () => {
    const dates = [
      '2026-09-28T13:00:00.000Z',
      '2026-09-30T13:00:00.000Z',
      '2026-10-02T13:00:00.000Z',
    ];
    const spec = parseContentPlanSpec(
      {
        strategy: {
          summary: 'Gerar conversa na agenda.',
          sequence: 'Dor, prova, convite.',
        },
        items: [
          {
            title: 'Capa da dor',
            hook: 'Sua terça está vazia?',
            caption: 'Salve este carrossel',
            format: 'carousel',
            structure: ['Capa', 'Dúvida', 'Resposta'],
            visualDirection: 'Fotos reais, fundo claro',
            cta: 'Chame no Direct',
          },
          { format: 'static' },
        ],
      },
      { ...plannerContext, postsPerWeek: 3, dates, formatMix: 'ai' },
    );
    expect(spec.items).toHaveLength(3);
    expect(spec.strategy.summary).toContain('conversa');
    expect(spec.items.map((item) => item.scheduledAt)).toEqual(dates);
    expect(spec.items.every((item) => item.format === 'carousel' || item.format === 'reel')).toBe(
      true,
    );
    expect(spec.items[1].format).toBe('reel');
    expect(spec.items[0].structure).toEqual(['Capa', 'Dúvida', 'Resposta']);
    expect(spec.items[0].id).toBeTruthy();
    expect(spec.items[0].status).toBe('draft');
  });

  it('no mix equilibrado ignora o formato da LLM', () => {
    const spec = parseContentPlanSpec(
      { items: [{ format: 'reel' }, { format: 'reel' }] },
      {
        ...plannerContext,
        formatMix: 'balanced',
        formats: ['carousel', 'static'],
      },
    );
    expect(spec.items[0].format).toBe('carousel');
    expect(spec.items[1].format).toBe('static');
  });

  it('lê o relatório IG, o corpus e recusa JSON vazio', () => {
    expect(summarizeIgReport({ overview: { who: 'Ana' } })?.overview.who).toBe(
      'Ana',
    );
    expect(summarizeIgReport({})).toBeNull();
    const summarized = summarizeIgReport({
      overview: { who: 'Ana' },
      corpus: { username: 'ana.studio', postCount: 9, themes: [{ tag: 'corte' }] },
    });
    expect(summarized?.corpus?.username).toBe('ana.studio');
    expect(summarized?.corpus?.themes).toEqual(['corte']);
  });

  it('separa identificado e inferido no contexto do cliente', () => {
    const context = buildClientContext({
      igJobId: 'ig-1',
      analyzedAt: new Date('2026-09-28T12:00:00.000Z'),
      report,
      lead: plannerContext.lead,
    });
    expect(context.username).toBe('studio.ana');
    expect(context.identified.postCount).toBe(12);
    expect(context.inferred.segment).toBe('Cortes e coloração');
    expect(context.suggestedTones).toContain('close');
  });

  it('reescreve o roteiro sem mudar formato nem data', () => {
    const base = parseContentPlanSpec(
      {
        items: [
          {
            title: 'Capa da dor',
            hook: 'Sua terça está vazia?',
            format: 'reel',
            structure: ['A', 'B'],
          },
        ],
      },
      plannerContext,
    ).items[0];
    const next = applyItemRewrite(base, {
      title: 'Presença com propósito',
      hook: 'Sua presença é estratégica?',
      caption: 'Salve este reel',
      structure: ['Cena 1', 'Cena 2', 'CTA'],
      visualDirection: 'Close no criador',
      cta: 'Comenta PRESENÇA',
    });
    expect(next.id).toBe(base.id);
    expect(next.format).toBe(base.format);
    expect(next.scheduledAt).toBe(base.scheduledAt);
    expect(next.title).toMatch(/Presença/);
    expect(next.structure).toEqual(['Cena 1', 'Cena 2', 'CTA']);
  });

  it('pede o que mudar no prompt de reescrita', () => {
    const item = parseContentPlanSpec(
      { items: [{ hook: 'Hook um' }] },
      plannerContext,
    ).items[0];
    const prompt = buildItemRewritePrompt(item, 'mais direto e menos genérico');
    expect(prompt).toContain('mais direto e menos genérico');
    expect(prompt).toContain(item.hook);
  });

  it('encaixa o hook visual no prompt de reescrita', () => {
    const item = parseContentPlanSpec(
      { items: [{ hook: 'Hook um', format: 'reel' }] },
      plannerContext,
    ).items[0];
    const prompt = buildItemRewritePrompt(item, 'use o stunt', {
      title: 'Realista / cinematográfico',
      summary: 'FPV de adrenalina',
      example: 'Cadeira amarrada ao avião — referência, não cena obrigatória.',
      prompt: 'cinematic FPV / drone videography of extreme sports',
    });
    expect(prompt).toContain('HOOK VISUAL');
    expect(prompt).toContain('cinematic FPV / drone videography of extreme sports');
    expect(prompt).toMatch(/NÃO uma cena travada/i);
    expect(prompt).toContain('Cadeira amarrada ao avião');
  });

  it('parte o reel em N takes com beats na structure', () => {
    const item = parseContentPlanSpec(
      {
        items: [
          {
            hook: 'Sua marca para?',
            format: 'reel',
            structure: ['Cena longa demais', 'CTA'],
          },
        ],
      },
      plannerContext,
    ).items[0];
    const prompt = buildBreakVideoTakesPrompt(item, 3, {
      title: 'Realista / cinematográfico',
      summary: 'FPV',
      prompt: 'cinematic FPV',
    });
    expect(prompt).toContain('EXATAMENTE 3 takes');
    expect(prompt).toContain('cinematic FPV');
    const broken = applyBreakVideoTakes(
      item,
      {
        takes: [
          {
            id: 'take-1',
            label: 'Take 1 · Hook',
            beat: 'Abre na pista',
            productionPrompt: 'FPV do carro puxando a cena',
          },
          {
            id: 'take-2',
            label: 'Take 2 · Meio',
            beat: 'Mostra a dúvida',
            productionPrompt: 'Close da pergunta',
          },
        ],
      },
      3,
    );
    expect(broken.videoTakes).toHaveLength(3);
    expect(broken.structure).toEqual([
      'Abre na pista',
      'Mostra a dúvida',
      broken.videoTakes![2].beat,
    ]);
    expect(broken.videoTakes![2].productionPrompt).toBeTruthy();
  });
});
