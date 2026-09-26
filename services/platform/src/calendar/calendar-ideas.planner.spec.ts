import {
  buildCalendarIdeasPrompt,
  parseCalendarIdeasSpec,
} from './calendar-ideas.planner';
import { buildLeadBrief } from '../owner/lead-brief';

const brief = buildLeadBrief({
  id: 'lead-1',
  name: 'Studio Ana',
  category: 'Salão de beleza',
  description: 'Cortes e coloração no centro.',
  city: 'Curitiba',
  state: 'PR',
});

const context = { brief, notes: 'Tom direto. Público: mulheres 25-40.' };

describe('calendar-ideas.planner', () => {
  it('monta o prompt com brief e notas', () => {
    const prompt = buildCalendarIdeasPrompt(context);
    expect(prompt).toContain('Studio Ana');
    expect(prompt).toContain('Salão de beleza');
    expect(prompt).toContain(context.notes);
    expect(prompt).toContain('não invente');
  });

  it('completa dores, hooks e 5 ideias com limites', () => {
    const spec = parseCalendarIdeasSpec(
      {
        pains: ['Agenda vazia na terça'],
        hooks: ['Sua terça está vazia? uma duas três quatro cinco seis sete'],
        ideas: [
          {
            title: 'Agenda vazia',
            hook: 'Sua terça está vazia?',
            caption: 'Só o gancho.',
            format: 'carousel',
            commentKeyword: 'agenda',
          },
        ],
      },
      context,
    );
    expect(spec.pains.length).toBeGreaterThanOrEqual(8);
    expect(spec.hooks).toHaveLength(spec.pains.length);
    expect(spec.hooks[0].split(/\s+/).length).toBeLessThanOrEqual(10);
    expect(spec.ideas).toHaveLength(5);
    expect(spec.ideas[0].caption).toMatch(/salv|coment/i);
    expect(spec.ideas[0].commentKeyword).toBe('AGENDA');
  });
});
