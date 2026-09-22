import type { LeadBrief } from '../landing/pipeline.types';
import {
  audienceNounFromCategory,
  buildFlyerImagePrompt,
  buildFlyerPlannerPrompt,
  parseFlyerSpec,
  type FlyerPlannerContext,
} from './flyer-venda.planner';

function dentistContext(notes: string): FlyerPlannerContext {
  const brief: LeadBrief = {
    leadId: 'lead-nicole',
    name: 'Dra. Nicole Barbosa',
    slug: 'dra-nicole-barbosa',
    outputDir: 'leads/dra-nicole-barbosa',
    category: 'Clínica odontológica',
    description: 'Dentista com foco em atendimento humanizado.',
    services: ['Clareamento', 'Implantes'],
    address: null,
    city: 'São Paulo',
    state: 'SP',
    country: 'BR',
    latitude: null,
    longitude: null,
    rating: null,
    reviewCount: null,
    omitted: [],
    present: ['name', 'category'],
    images: [],
    videos: [],
    contacts: {},
  };
  return {
    brief,
    packages: [
      {
        id: 'pkg-1',
        name: 'Site Estratégico',
        summary: 'Para conversão',
        description: 'Site moderno para atrair pacientes',
        price: 1200,
        promoPrice: 800,
        currency: 'BRL',
        benefits: ['Site profissional', 'Estrutura estratégica', 'Posicionamento no Google'],
      },
      {
        id: 'pkg-2',
        name: 'Atendimento & Gestão',
        summary: 'Tudo do Pacote I +',
        description: 'Automação de agenda e WhatsApp',
        price: 2500,
        currency: 'BRL',
        benefits: ['Atendimento automatizado', 'Agenda integrada'],
      },
    ],
    notes,
    photoCount: 1,
  };
}

describe('flyer-venda.planner', () => {
  it('usa pacientes para clínica odontológica', () => {
    expect(audienceNounFromCategory('Clínica odontológica')).toBe('pacientes');
    expect(audienceNounFromCategory('Advocacia')).toBe('clientes');
  });

  it('monta o prompt do planner com lead, pacotes e notas de desconto', () => {
    const prompt = buildFlyerPlannerPrompt(
      dentistContext(
        'Pacote I de R$ 1.200 por R$ 800 (33%). Pacote II de R$ 2.500 por R$ 1.800 (28%).',
      ),
    );
    expect(prompt).toContain('Dra. Nicole Barbosa');
    expect(prompt).toContain('Clínica odontológica');
    expect(prompt).toContain('Site Estratégico');
    expect(prompt).toContain('Atendimento & Gestão');
    expect(prompt).toContain('R$ 1.200 por R$ 800');
    expect(prompt).toContain('Preço promocional');
    expect(prompt).toContain('flyer-venda-landing');
  });

  it('valida o JSON do planner com preços promocionais e vocabulário do nicho', () => {
    const spec = parseFlyerSpec(
      {
        kicker: 'DRA. NICOLE BARBOSA',
        headline: 'Sua presença digital pode trabalhar por você.',
        subhead: 'Mais visibilidade, mais pacientes.',
        intro: 'A Namão Criativa ajuda a conquistar mais pacientes.',
        audienceNoun: 'pacientes',
        packages: [
          {
            label: 'PACOTE I',
            title: 'SITE ESTRATÉGICO',
            subtitle: 'PARA CONVERSÃO',
            bullets: ['Site profissional', 'Estrutura estratégica'],
            priceFrom: 'R$ 1.200',
            priceTo: 'R$ 800',
            savings: 'ECONOMIA DE 33%',
          },
          {
            label: 'PACOTE II',
            title: 'ATENDIMENTO & GESTÃO',
            bullets: ['Atendimento automatizado'],
            priceFrom: 'R$ 2.500',
            priceTo: 'R$ 1.800',
            savings: 'ECONOMIA DE 28%',
          },
        ],
        footerBenefits: ['Mais visibilidade', 'Mais pacientes'],
        cta: 'Fale com a gente',
        closingLine: 'Sua clínica no digital.',
        layoutNotes: 'Dois cards neon',
      },
      dentistContext('de 1200 por 800'),
    );

    expect(spec.audienceNoun).toBe('pacientes');
    expect(spec.intro).toContain('pacientes');
    expect(spec.packages[0].priceFrom).toBe('R$ 1.200');
    expect(spec.packages[0].priceTo).toBe('R$ 800');
    expect(spec.packages[1].priceTo).toBe('R$ 1.800');
  });

  it('trava as strings do spec no prompt de imagem', () => {
    const spec = parseFlyerSpec(
      {
        headline: 'Sua presença digital pode trabalhar por você.',
        audienceNoun: 'pacientes',
        packages: [
          {
            title: 'SITE ESTRATÉGICO',
            priceFrom: 'R$ 1.200',
            priceTo: 'R$ 800',
          },
        ],
      },
      dentistContext(''),
    );
    const prompt = buildFlyerImagePrompt(spec);
    expect(prompt).toContain('Sua presença digital pode trabalhar por você.');
    expect(prompt).toContain('SITE ESTRATÉGICO');
    expect(prompt).toContain('R$ 800');
    expect(prompt).toContain('Namão Criativa');
    expect(prompt).toContain('print these Brazilian Portuguese texts EXACTLY');
  });

  it('usa o preço promocional cadastrado no fallback do card', () => {
    const spec = parseFlyerSpec({}, dentistContext(''));
    expect(spec.packages[0].priceFrom).toMatch(/1\.200/);
    expect(spec.packages[0].priceTo).toMatch(/800/);
    expect(spec.packages[0].savings).toMatch(/ECONOMIA/);
    expect(spec.packages[1].priceFrom).toBeNull();
  });
});
