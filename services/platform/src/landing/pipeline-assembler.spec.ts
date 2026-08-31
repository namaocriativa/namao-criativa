import { buildLeadBrief } from './lead-brief';
import {
  assembleLandingFiles,
  parseReviewResult,
  parseSitePlan,
} from './pipeline-assembler';
import type { LeadBrief } from './pipeline.types';

function sampleBrief(overrides: Partial<LeadBrief> = {}): LeadBrief {
  const base = buildLeadBrief({
    id: 'lead1',
    name: 'Escritório Teste',
    city: 'São Paulo',
    state: 'SP',
    address: 'Rua Exemplo, 100',
    phone: '(11) 3000-0000',
    images: [{ filename: 'foto-01.jpg', source: 'web' }],
  });
  return { ...base, ...overrides };
}

describe('pipeline-assembler', () => {
  it('rejeita seção services quando o brief não tem serviços e o usuário não travou seções', () => {
    const brief = sampleBrief({ services: null, omitted: ['services'] });
    const plan = parseSitePlan(
      {
        visualDirection: 'limpo',
        tone: 'formal',
        primaryCta: null,
        sections: ['header', 'hero', 'services', 'footer'],
        notes: '',
      },
      brief,
    );
    expect(plan.sections).not.toContain('services');
    expect(plan.sections).toEqual(['header', 'hero', 'footer']);
  });

  it('respeita seções travadas pelo usuário, inclusive custom, e preenche guias', () => {
    const brief = sampleBrief({ services: null, omitted: ['services'] });
    const plan = parseSitePlan(
      {
        visualDirection: 'editorial',
        tone: 'direto',
        sectionGuides: [
          {
            sectionId: 'hero',
            layout: 'full-bleed',
            visualEmphasis: 'nome grande',
            hierarchy: 'eyebrow → título',
            imageUse: 'foto do brief',
            spacing: 'alto',
            cta: 'whatsapp',
            notes: 'sem slogan',
          },
        ],
      },
      brief,
      [
        {
          id: 'hero',
          type: 'hero',
          title: 'Hero',
          description: 'Abertura',
        },
        {
          id: 'horario',
          type: 'custom',
          title: 'Horário',
          description: 'Só se houver horário no brief',
        },
        {
          id: 'contact',
          type: 'contact',
          title: 'Contato',
          description: 'Fatos de contato',
        },
      ],
    );
    expect(plan.sections).toEqual(['hero', 'horario', 'contact']);
    expect(plan.sectionGuides).toHaveLength(3);
    expect(plan.sectionGuides[0].layout).toBe('full-bleed');
    expect(plan.sectionGuides[1].sectionId).toBe('horario');
    expect(plan.sectionGuides[1].notes).toContain('horário');
  });

  it('monta arquivos Vite+React a partir do Page Spec e overlays', () => {
    const brief = sampleBrief();
    const files = assembleLandingFiles({
      brief,
      spec: {
        version: 1,
        theme: {
          style: 'premium',
          visualLanguage: 'limpo',
          colorStrategy: 'neutro',
          imageStrategy: 'balanced',
          density: 'medium',
          radius: 'small',
          spacing: 'generous',
          paletteId: 'slate-teal',
          fontPairId: 'fraunces-source',
        },
        sections: [
          {
            id: 'header',
            type: 'header',
            component: 'navbar.minimal',
            purpose: 'nav',
            props: { brand: brief.name, nav: [], cta: null },
          },
          {
            id: 'hero',
            type: 'hero',
            component: 'hero.split-image',
            purpose: 'abertura',
            props: {
              eyebrow: 'São Paulo, SP',
              headline: brief.name,
              description: '',
              image: '/images/foto-01.jpg',
              cta: null,
            },
          },
          {
            id: 'footer',
            type: 'footer',
            component: 'footer.minimal',
            purpose: 'rodapé',
            props: { brand: brief.name, location: '', nav: [], links: [] },
          },
        ],
        overlays: [
          {
            component: 'scroll-progress',
            html: '<div data-ui-scroll-progress><span></span></div>',
            css: '[data-ui-scroll-progress]{height:2px}',
            js: '/* scroll-progress */',
          },
        ],
        features: [],
      },
    });
    const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));
    expect(byPath['index.html']).toContain('/src/main.tsx');
    expect(byPath['index.html']).toContain('data-ui-scroll-progress');
    expect(byPath['index.html']).toContain('[data-ui-scroll-progress]');
    expect(byPath['src/App.tsx']).toContain('LandingPage');
    expect(byPath['page-spec.json']).toContain('hero.split-image');
    expect(byPath['page-spec.json']).toContain('Escritório Teste');
    expect(byPath['src/main.tsx']).toContain('theme/tailwind.css');
    expect(byPath['vite.config.js']).toContain('@tailwindcss/vite');
    expect(byPath['package.json']).toContain('motion');
    expect(byPath['package.json']).toContain('gsap');
    expect(byPath['package.json']).toContain('lenis');
    expect(byPath['src/theme.css']).toContain('--ink:');
    expect(byPath['README.md']).toContain(brief.outputDir);
  });

  it('injeta window.LEAD_DISCOVERY quando há publicSiteId', () => {
    const files = assembleLandingFiles({
      brief: sampleBrief(),
      spec: {
        version: 1,
        theme: {
          style: 'premium',
          visualLanguage: 'limpo',
          colorStrategy: 'neutro',
          imageStrategy: 'balanced',
          density: 'medium',
          radius: 'small',
          spacing: 'generous',
          paletteId: 'slate-teal',
          fontPairId: 'fraunces-source',
        },
        sections: [
          {
            id: 'hero',
            type: 'hero',
            component: 'hero.split-image',
            purpose: 'abertura',
            props: { headline: 'Teste', nav: [], cta: null, brand: 'Teste' },
          },
        ],
        overlays: [],
        features: [{ id: 'features.ai-chat', props: {} }],
      },
      publicSiteId: 'site_abc',
      apiBase: 'https://api.example.com',
    });
    const html = files.find((file) => file.path === 'index.html')?.content || '';
    expect(html).toContain('window.LEAD_DISCOVERY=');
    expect(html).toContain('site_abc');
    expect(html).toContain('https://api.example.com');
  });

  it('serializa seção custom no page-spec com id estável', () => {
    const brief = sampleBrief();
    const files = assembleLandingFiles({
      brief,
      spec: {
        version: 1,
        theme: {
          style: 'modern',
          visualLanguage: 'limpo',
          colorStrategy: 'direto',
          imageStrategy: 'balanced',
          density: 'medium',
          radius: 'small',
          spacing: 'generous',
          paletteId: 'slate-teal',
          fontPairId: 'fraunces-source',
        },
        sections: [
          {
            id: 'horario',
            type: 'custom',
            component: 'content.block',
            purpose: 'horário',
            props: {
              title: 'Horário',
              body: 'Atendimento local',
              items: [],
              cta: null,
            },
          },
        ],
        overlays: [],
        features: [],
      },
    });
    const spec = files.find((file) => file.path === 'page-spec.json')?.content || '';
    expect(spec).toContain('"id": "horario"');
    expect(spec).toContain('Horário');
    expect(spec).toContain('Atendimento local');
  });

  it('parseia issues estruturadas e ignora files do modelo', () => {
    const review = parseReviewResult({
      approved: false,
      files: [{ path: 'index.html', content: '<html>hack</html>' }],
      sections: [{ id: 'hero', content: { title: 'Novo' } }],
      issues: [
        { sectionId: 'hero', field: 'subtitle', problem: 'slogan inventado' },
        'telefone inventado',
      ],
    });
    expect(review.approved).toBe(false);
    expect(review).not.toHaveProperty('files');
    expect(review).not.toHaveProperty('sections');
    expect(review.issues).toEqual([
      { sectionId: 'hero', field: 'subtitle', problem: 'slogan inventado' },
      { sectionId: '', problem: 'telefone inventado' },
    ]);
  });

  it('só aprova revisão sem issues', () => {
    const review = parseReviewResult({
      approved: true,
      issues: [{ sectionId: 'hero', problem: 'ainda errado' }],
    });
    expect(review.approved).toBe(false);
    expect(parseReviewResult({ approved: true, issues: [] }).approved).toBe(
      true,
    );
  });
});
