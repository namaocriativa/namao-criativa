import { sliceBriefForSection, sliceVisionForSection } from './brief-slice';
import { buildLeadBrief } from './lead-brief';
import { parseSitePlan } from './pipeline-assembler';
import type { LeadBrief, SitePlan } from './pipeline.types';

function sampleBrief(overrides: Partial<LeadBrief> = {}): LeadBrief {
  const base = buildLeadBrief({
    id: 'lead1',
    name: 'Escritório Teste',
    city: 'São Paulo',
    state: 'SP',
    category: 'Advocacia',
    description: 'Atuação em direito civil.',
    services: ['Consultoria Premium XYZ', 'Assessoria'],
    phone: '(11) 3000-0000',
    images: [
      { filename: 'foto-01.jpg', source: 'web' },
      { filename: 'logo.png', source: 'https://example.com/logo.png' },
    ],
  });
  return { ...base, ...overrides };
}

function samplePlan(brief: LeadBrief): SitePlan {
  return parseSitePlan(
    { sections: ['header', 'hero', 'services', 'footer'] },
    brief,
    [
      { id: 'header', type: 'header', title: 'Header', description: '' },
      { id: 'hero', type: 'hero', title: 'Hero', description: '' },
      { id: 'services', type: 'services', title: 'Serviços', description: '' },
      { id: 'footer', type: 'footer', title: 'Footer', description: '' },
    ],
  );
}

describe('brief-slice', () => {
  it('hero não inclui services nem source de imagem', () => {
    const brief = sampleBrief();
    const slice = sliceBriefForSection(brief, 'hero', samplePlan(brief));
    expect(JSON.stringify(slice)).not.toContain('Consultoria Premium XYZ');
    expect(JSON.stringify(slice)).not.toContain('services');
    expect(JSON.stringify(slice)).not.toContain('example.com/logo');
    expect(slice.name).toBe('Escritório Teste');
    expect(Array.isArray(slice.photos)).toBe(true);
  });

  it('services não inclui lista de imagens', () => {
    const brief = sampleBrief();
    const slice = sliceBriefForSection(brief, 'services', samplePlan(brief));
    expect(JSON.stringify(slice)).not.toContain('/images/');
    expect(slice.services).toEqual(['Consultoria Premium XYZ', 'Assessoria']);
  });

  it('visão do hero só traz sugestão e notas de foto', () => {
    const slice = sliceVisionForSection(
      {
        atmosphere: 'sóbrio',
        colorHints: ['navy'],
        logoNotes: 'header claro',
        photoNotes: 'fachada',
        heroSuggestion: 'full-bleed',
        avoid: ['neon'],
      },
      'hero',
    );
    expect(slice).toEqual({
      heroSuggestion: 'full-bleed',
      photoNotes: 'fachada',
    });
    expect(JSON.stringify(slice)).not.toContain('neon');
  });
});
