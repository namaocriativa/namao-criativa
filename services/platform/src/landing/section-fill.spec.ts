import { buildLeadBrief } from './lead-brief';
import { parseSitePlan } from './pipeline-assembler';
import { fillDeterministicSection } from './section-fill';
import type { LeadBrief } from './pipeline.types';

function sampleBrief(overrides: Partial<LeadBrief> = {}): LeadBrief {
  const base = buildLeadBrief({
    id: 'lead1',
    name: 'Escritório Teste',
    city: 'São Paulo',
    services: ['Consultoria', 'Assessoria'],
    phone: '(11) 3000-0000',
    rating: 4.8,
    reviewCount: 12,
    images: [{ filename: 'foto-01.jpg' }],
  });
  return { ...base, ...overrides };
}

describe('section-fill', () => {
  it('preenche services com os itens do brief', () => {
    const brief = sampleBrief();
    const plan = parseSitePlan({ sections: ['services'] }, brief, [
      { id: 'services', type: 'services', title: 'Serviços', description: '' },
    ]);
    const section = fillDeterministicSection(brief, plan, plan.sectionConfigs[0]);
    expect(section?.content.items).toEqual(['Consultoria', 'Assessoria']);
  });

  it('preenche gallery só com photos e footer com o nome', () => {
    const brief = sampleBrief();
    const plan = parseSitePlan({}, brief, [
      { id: 'gallery', type: 'gallery', title: 'Galeria', description: '' },
      { id: 'footer', type: 'footer', title: 'Footer', description: '' },
    ]);
    const gallery = fillDeterministicSection(brief, plan, plan.sectionConfigs[0]);
    const footer = fillDeterministicSection(brief, plan, plan.sectionConfigs[1]);
    expect(gallery?.content.imageRefs).toEqual(['/images/foto-01.jpg']);
    expect(footer?.content.title).toBe('Escritório Teste');
  });

  it('não preenche hero (não é deterministic)', () => {
    const brief = sampleBrief();
    const plan = parseSitePlan({}, brief, [
      { id: 'hero', type: 'hero', title: 'Hero', description: '' },
    ]);
    expect(fillDeterministicSection(brief, plan, plan.sectionConfigs[0])).toBeNull();
  });

  it('header monta nav a partir do plano', () => {
    const brief = sampleBrief();
    const plan = parseSitePlan({}, brief, [
      { id: 'header', type: 'header', title: 'Header', description: '' },
      { id: 'hero', type: 'hero', title: 'Hero', description: '' },
      { id: 'footer', type: 'footer', title: 'Footer', description: '' },
    ]);
    const header = fillDeterministicSection(brief, plan, plan.sectionConfigs[0]);
    expect(header?.content.nav).toEqual([{ label: 'Hero', href: '#hero' }]);
  });
});
