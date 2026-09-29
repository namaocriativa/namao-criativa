import { buildLeadBrief } from '../owner/lead-brief';
import { buildLeadPromptRewriteTask, parseLeadPrompt } from './site-prompt';

describe('site-prompt', () => {
  it('inclui nome e categoria do lead no pedido', () => {
    const brief = buildLeadBrief({
      id: 'lead-1',
      name: 'Clínica Aurora',
      category: 'Estética',
      city: 'Campinas',
    });
    const task = buildLeadPromptRewriteTask(brief, 'Tom sóbrio', ['hero.jpg']);
    expect(task).toContain('Clínica Aurora');
    expect(task).toContain('Estética');
    expect(task).toContain('video1.mp4');
    expect(task).toContain('hero.jpg');
    expect(task).toContain('Não invente telefone');
  });

  it('inclui a estrutura aprovada e a lacuna de contato', () => {
    const brief = buildLeadBrief({ id: 'lead-1', name: 'Firma' });
    const task = buildLeadPromptRewriteTask(brief, '', [], {
      objective: 'bookings',
      objectiveNote: '',
      sections: [
        {
          id: 'hero',
          kind: 'hero',
          title: 'Agenda',
          purpose: 'Convidar para marcar',
          facts: ['name'],
          cta: '',
        },
      ],
      gaps: [
        {
          key: 'whatsapp',
          label: 'WhatsApp',
          note: 'Não inventar número.',
          confidence: 'identified',
        },
      ],
      images: [{ filename: 'sala.jpg', section: 'hero', kind: 'photo' }],
      notes: '',
    });
    expect(task).toContain('Gerar agendamentos');
    expect(task).toContain('Não inventar número.');
    expect(task).toContain('sala.jpg → hero');
  });

  it('valida o JSON do prompt adaptado', () => {
    expect(() => parseLeadPrompt({ prompt: 'curto' })).toThrow();
    expect(parseLeadPrompt({ prompt: 'x'.repeat(50) }).prompt.length).toBe(50);
  });
});
