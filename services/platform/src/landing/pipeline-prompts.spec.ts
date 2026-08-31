import { buildLeadBrief } from './lead-brief';
import { parseDesignSystem, parseSitePlan } from './pipeline-assembler';
import {
  buildArtDirectorPrompt,
  buildPexelsQueryPrompt,
  buildSectionPrompt,
} from './pipeline-prompts';
import type { LeadBrief } from './pipeline.types';

function sampleBrief(): LeadBrief {
  return buildLeadBrief({
    id: 'lead1',
    name: 'Escritório Teste',
    city: 'São Paulo',
    services: ['Consultoria Premium XYZ'],
    phone: '(11) 3000-0000',
    images: [{ filename: 'foto-01.jpg' }],
  });
}

describe('pipeline-prompts', () => {
  it('prompt de hero não inclui services do brief', () => {
    const brief = sampleBrief();
    const plan = parseSitePlan({}, brief, [
      { id: 'hero', type: 'hero', title: 'Hero', description: 'Abertura' },
    ]);
    const design = parseDesignSystem({ paletteId: 'slate-teal' });
    const prompt = buildSectionPrompt({
      brief,
      plan,
      design,
      sectionId: 'hero',
      sectionConfig: plan.sectionConfigs[0],
      previous: [],
    });
    expect(prompt).not.toContain('Consultoria Premium XYZ');
    expect(prompt).toContain('Escritório Teste');
    expect(prompt).not.toContain('items exatamente iguais ao brief.services');
  });

  it('prompt de services não lista imagens', () => {
    const brief = sampleBrief();
    const plan = parseSitePlan({}, brief, [
      {
        id: 'services',
        type: 'services',
        title: 'Serviços',
        description: 'Lista',
      },
    ]);
    const design = parseDesignSystem({});
    const prompt = buildSectionPrompt({
      brief,
      plan,
      design,
      sectionId: 'services',
      sectionConfig: plan.sectionConfigs[0],
      previous: [],
    });
    expect(prompt).not.toContain('/images/foto-01.jpg');
    expect(prompt).toContain('Consultoria Premium XYZ');
  });

  it('prompt de query Pexels pede inglês e omite o nome como query', () => {
    const prompt = buildPexelsQueryPrompt(sampleBrief());
    expect(prompt).toContain('INGLÊS');
    expect(prompt).toContain('Escritório Teste');
    expect(prompt).toContain('queryAlt');
  });

  it('Art Director recebe paleta travada e intensidade', () => {
    const prompt = buildArtDirectorPrompt(sampleBrief(), null, [], {
      colors: {
        paper: '#95f9e3',
        surface: '#69ebd0',
        accent: '#49d49d',
        ink: '#564946',
        muted: '#558564',
      },
      intensity: 'high',
    });
    expect(prompt).toContain('#95f9e3');
    expect(prompt).toContain('#49d49d');
    expect(prompt).toContain('Intensidade High');
    expect(prompt).toContain('NÃO invente outras cores');
  });
});
