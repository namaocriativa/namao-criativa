import { buildLeadBrief } from '../owner/lead-brief';
import { compactIgCorpus } from './ig-corpus';
import { parseIgReport } from './ig-report';

describe('parseIgReport', () => {
  it('exige 5 ideias no shape do calendário', () => {
    const brief = buildLeadBrief({
      id: 'lead-1',
      name: 'Clínica Aurora',
      category: 'Estética',
      city: 'Campinas',
    });
    const corpus = compactIgCorpus(
      [
        {
          id: '1',
          mediaType: 'IMAGE',
          url: 'x',
          caption: 'Limpeza de pele em Campinas. Comenta AGENDA',
          timestamp: '2026-09-20T10:00:00.000Z',
        },
      ],
      { username: 'aurora', windowDays: 30 },
    );
    const report = parseIgReport(
      {
        overview: {
          who: 'Clínica Aurora',
          sells: 'estética',
          audience: 'Campinas',
          stage: 'em construção',
        },
        voice: { adjectives: ['acolhedor'], quotes: ['Comenta AGENDA'] },
        pillars: ['tratamento'],
        gaps: ['prova social'],
        plan: [{ week: 'Semana 1', mix: '2 Reels', goal: 'agendar' }],
        ideas: [
          {
            title: 'Limpeza de pele',
            hook: 'Sua pele pede rotina',
            caption: 'Salva esse post',
            format: 'reel',
            commentKeyword: 'AGENDA',
          },
        ],
      },
      { brief, notes: '', corpus },
    );
    expect(report.ideas).toHaveLength(5);
    expect(report.ideas[0].format).toBe('reel');
    expect(report.ideas[0].caption).toMatch(/salv|coment/i);
    expect(report.corpus.postCount).toBe(1);
    expect(report.voice.quotes[0]).toContain('AGENDA');
  });
});
