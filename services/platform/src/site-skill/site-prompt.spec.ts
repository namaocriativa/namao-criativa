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
  });

  it('valida o JSON do prompt adaptado', () => {
    expect(() => parseLeadPrompt({ prompt: 'curto' })).toThrow();
    expect(parseLeadPrompt({ prompt: 'x'.repeat(50) }).prompt.length).toBe(50);
  });
});
