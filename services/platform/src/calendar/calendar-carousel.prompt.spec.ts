import { buildLeadBrief } from '../owner/lead-brief';
import {
  buildCarouselSkillPrompt,
  isInstagramSourceUrl,
  normalizeSourceUrl,
} from './calendar-carousel.prompt';

const brief = buildLeadBrief({
  id: 'lead-1',
  name: 'Studio Ana',
  category: 'Salão de beleza',
  description: 'Cortes e coloração no centro.',
  city: 'Curitiba',
  state: 'PR',
  instagram: 'https://www.instagram.com/studio.ana/',
  website: 'https://studioana.com.br',
});

describe('calendar-carousel.prompt', () => {
  it('normaliza handle simples para o perfil do Instagram', () => {
    expect(normalizeSourceUrl('@studio.ana')).toBe(
      'https://www.instagram.com/studio.ana/',
    );
    expect(normalizeSourceUrl('lojaok')).toBe(
      'https://www.instagram.com/lojaok/',
    );
  });

  it('reconhece Instagram e não trata site como Instagram', () => {
    expect(
      isInstagramSourceUrl('https://www.instagram.com/studio.ana/'),
    ).toBe(true);
    expect(isInstagramSourceUrl('https://studioana.com.br')).toBe(false);
  });

  it('monta o prompt com brief e o link, sem scrape de post', () => {
    const prompt = buildCarouselSkillPrompt({
      brief,
      sourceUrl: 'https://www.instagram.com/studio.ana/',
      notes: 'Tom direto',
    });
    expect(prompt).toContain('Studio Ana');
    expect(prompt).toContain('https://www.instagram.com/studio.ana/');
    expect(prompt).toContain('Tom direto');
    expect(prompt).not.toContain('permalink');
  });

  it('inclui contexto do site quando o snippet vem do extrator', () => {
    const prompt = buildCarouselSkillPrompt({
      brief,
      sourceUrl: 'https://studioana.com.br/',
      snippet: 'Studio Ana | Cortes no centro',
    });
    expect(prompt).toContain('https://studioana.com.br/');
    expect(prompt).toContain('Cortes no centro');
  });
});
