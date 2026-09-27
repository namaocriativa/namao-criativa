import {
  buildContentPlanPrompt,
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
};

describe('content-plan.planner', () => {
  it('espalha 3 posts na semana em seg, qua e sex', () => {
    expect(weekdayOffsets(3)).toEqual([0, 2, 4]);
    const monday = nextMonday(new Date('2026-09-22T15:00:00.000Z'));
    expect(monday.getDay()).toBe(1);
    const dates = buildScheduleDates(3, 2, new Date('2026-09-22T15:00:00.000Z'));
    expect(dates).toHaveLength(6);
    expect(dates[0].getDay()).toBe(1);
    expect(dates[1].getDay()).toBe(3);
    expect(dates[2].getDay()).toBe(5);
    expect(dates[3].getTime() - dates[0].getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('monta o prompt com overview e pilares do relatório IG', () => {
    const dates = ['2026-09-28T13:00:00.000Z', '2026-09-30T13:00:00.000Z'];
    const prompt = buildContentPlanPrompt({
      title: 'Setembro firme',
      description: 'Tom direto. Foco em agenda.',
      postsPerWeek: 2,
      weeks: 1,
      formats: ['carousel', 'reel'],
      dates,
      report,
    });
    expect(prompt).toContain('Studio Ana');
    expect(prompt).toContain('antes e depois');
    expect(prompt).toContain('prova social');
    expect(prompt).toContain('Setembro firme');
    expect(prompt).toContain('carousel|reel');
    expect(prompt).toContain('não invente');
  });

  it('completa N itens, só nos formatos pedidos, com datas na ordem', () => {
    const dates = [
      '2026-09-28T13:00:00.000Z',
      '2026-09-30T13:00:00.000Z',
      '2026-10-02T13:00:00.000Z',
    ];
    const spec = parseContentPlanSpec(
      {
        items: [
          {
            title: 'Capa da dor',
            hook: 'Sua terça está vazia?',
            caption: 'Salve este carrossel',
            format: 'carousel',
          },
          { format: 'static' },
        ],
      },
      {
        title: 'Plano',
        description: '',
        postsPerWeek: 3,
        weeks: 1,
        formats: ['carousel', 'reel'],
        dates,
        report,
      },
    );
    expect(spec.items).toHaveLength(3);
    expect(spec.items.map((item) => item.scheduledAt)).toEqual(dates);
    expect(spec.items.every((item) => item.format === 'carousel' || item.format === 'reel')).toBe(
      true,
    );
    expect(spec.items[1].format).toBe('reel');
  });

  it('lê o relatório IG e recusa JSON vazio', () => {
    expect(summarizeIgReport({ overview: { who: 'Ana' } })?.overview.who).toBe(
      'Ana',
    );
    expect(summarizeIgReport({})).toBeNull();
  });
});
