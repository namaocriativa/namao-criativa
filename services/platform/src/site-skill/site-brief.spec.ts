import { buildSiteSkillBrief, isLeadImageSelected } from './site-brief';

const report = {
  overview: {
    who: 'Clínica Aurora',
    sells: 'Harmonização e limpeza de pele',
    audience: 'Mulheres adultas em Campinas',
    stage: 'em construção',
  },
  voice: { adjectives: ['sóbrio', 'próximo'] },
  pillars: ['rotina de pele', 'antes e depois'],
  corpus: { username: 'clinica.aurora' },
};

describe('buildSiteSkillBrief', () => {
  it('classifica cadastro como confirmado e análise como identificada', () => {
    const brief = buildSiteSkillBrief(
      {
        name: 'Clínica Aurora',
        category: 'Estética',
        services: ['Limpeza de pele'],
        whatsapp: '19999990000',
        city: 'Campinas',
        state: 'SP',
        instagram: 'https://instagram.com/clinica.aurora',
      },
      { id: 'ig-1', createdAt: '2026-09-28T12:00:00.000Z', report },
    );
    const name = brief.facts.find((fact) => fact.key === 'name');
    const services = brief.facts.find((fact) => fact.key === 'services');
    const audience = brief.facts.find((fact) => fact.key === 'audience');
    expect(name).toMatchObject({
      confidence: 'confirmed',
      origin: 'Cadastro do lead',
      value: 'Clínica Aurora',
    });
    expect(services).toMatchObject({
      confidence: 'identified',
      origin: 'Cadastro do lead',
    });
    expect(audience).toMatchObject({
      confidence: 'identified',
      origin: 'Análise da IA',
      value: 'Mulheres adultas em Campinas',
    });
    expect(brief.igReady).toBe(true);
    expect(brief.handle).toBe('clinica.aurora');
    expect(brief.notice).toBeNull();
    expect(brief.facts.some((fact) => fact.key === 'who')).toBe(false);
    expect(brief.gaps.some((gap) => gap.key === 'whatsapp')).toBe(false);
    expect(brief.gaps.some((gap) => gap.key === 'commercial')).toBe(true);
  });

  it('não inventa contato e avisa quando não há relatório', () => {
    const brief = buildSiteSkillBrief({ name: 'Firma' }, null);
    expect(brief.igReady).toBe(false);
    expect(brief.notice).toMatch(/Skill Instagram/);
    expect(brief.facts.map((fact) => fact.key)).toEqual(['name']);
    expect(brief.gaps.map((gap) => gap.key)).toEqual([
      'commercial',
      'whatsapp',
      'location',
      'services',
    ]);
    expect(brief.gaps.find((gap) => gap.key === 'whatsapp')?.note).toMatch(
      /Não inventar/,
    );
  });

  it('recomenda um conjunto curto e separa o logo', () => {
    const images = [
      {
        filename: 'logo.png',
        localPath: 'storage/logo.png',
        width: 200,
        height: 200,
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        filename: `foto-${index}.jpg`,
        localPath: `storage/foto-${index}.jpg`,
        width: index < 3 ? 1200 - index : null,
        height: index < 3 ? 800 : null,
      })),
    ];
    const brief = buildSiteSkillBrief({ name: 'Firma', images }, null);
    const logo = brief.images.find((image) => image.filename === 'logo.png');
    const recommendedPhotos = brief.images.filter(
      (image) => image.kind === 'photo' && image.recommended,
    );
    expect(logo).toMatchObject({
      kind: 'logo',
      recommended: true,
      src: '/storage/logo.png',
    });
    expect(recommendedPhotos).toHaveLength(3);
    expect(recommendedPhotos.map((image) => image.filename)).toEqual([
      'foto-0.jpg',
      'foto-1.jpg',
      'foto-2.jpg',
    ]);
    expect(recommendedPhotos[0].section).toBe('hero');
    expect(recommendedPhotos[1].section).toBe('about');
    expect(brief.images.filter((image) => image.recommended)).toHaveLength(4);
  });

  it('limita fotos sem dimensão e não copia arquivo fora da seleção', () => {
    const images = Array.from({ length: 6 }, (_, index) => ({
      filename: `solta-${index}.jpg`,
      localPath: `storage/solta-${index}.jpg`,
    }));
    const brief = buildSiteSkillBrief({ name: 'Firma', images }, null);
    expect(brief.images.filter((image) => image.recommended)).toHaveLength(4);
    expect(isLeadImageSelected('solta-0.jpg', new Set(['solta-0.jpg']))).toBe(
      true,
    );
    expect(isLeadImageSelected('solta-1.jpg', new Set())).toBe(false);
    expect(isLeadImageSelected('', new Set(['']))).toBe(false);
  });
});
