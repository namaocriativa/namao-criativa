import { applyCopywriterOverride, buildLeadBrief } from './lead-brief';

describe('applyCopywriterOverride', () => {
  const thin = buildLeadBrief({
    id: 'lead-1',
    name: 'Juliane Binotto',
    phone: '5519982812026',
    city: 'Leme',
    state: 'SP',
    instagram: 'https://www.instagram.com/julianepbinotto_estetica/',
  });

  it('não inventa campos quando o override está vazio', () => {
    expect(applyCopywriterOverride(thin)).toEqual(thin);
    expect(applyCopywriterOverride(thin, {})).toEqual(thin);
  });

  it('preenche serviços, descrição e categoria sem apagar o que já existia', () => {
    const next = applyCopywriterOverride(thin, {
      category: 'Estética',
      description: 'Estética avançada em Leme.',
      services: ['Limpeza de pele', 'Botox'],
      notes: 'Atende mulheres adultas.',
    });
    expect(next.category).toBe('Estética');
    expect(next.services).toEqual(['Limpeza de pele', 'Botox']);
    expect(next.description).toContain('Estética avançada em Leme.');
    expect(next.description).toContain('Atende mulheres adultas.');
    expect(next.omitted).not.toContain('services');
    expect(next.omitted).not.toContain('description');
    expect(next.present).toEqual(
      expect.arrayContaining(['name', 'category', 'description', 'services']),
    );
    expect(next.contacts.phone).toBe('5519982812026');
  });

  it('não apaga description do enrichment se o campo do wizard veio vazio', () => {
    const rich = buildLeadBrief({
      id: 'lead-2',
      name: 'Clínica',
      description: 'Texto original',
      services: ['Consulta'],
    });
    const next = applyCopywriterOverride(rich, { category: 'Saúde' });
    expect(next.description).toBe('Texto original');
    expect(next.services).toEqual(['Consulta']);
    expect(next.category).toBe('Saúde');
  });
});
