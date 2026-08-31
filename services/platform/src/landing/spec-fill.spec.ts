import { parsePageSpec } from '@namao/landing-kit';
import { buildLeadBrief } from './lead-brief';
import {
  applyAssignedMedia,
  coerceComponentId,
  fillDeterministicProps,
  grammarBriefFromLead,
  primaryCtaFromBrief,
  resolveArchitecture,
  sanitizeProps,
} from './spec-fill';

describe('spec-fill', () => {
  const brief = buildLeadBrief({
    id: 'x',
    name: 'Firma',
    services: ['Consultoria'],
    phone: '11999999999',
    images: [{ filename: 'foto.jpg' }],
  });

  it('preenche features com services do brief', () => {
    const props = fillDeterministicProps('features.cards', brief, {
      nav: [],
      primaryCta: primaryCtaFromBrief(brief),
    });
    expect(props?.items).toEqual(['Consultoria']);
  });

  it('só aceita variante permitida para o tipo', () => {
    const grammar = grammarBriefFromLead(brief, ['hero']);
    expect(coerceComponentId('hero.split-image', 'hero', grammar)).toBe(
      'hero.split-image',
    );
    expect(coerceComponentId('footer.premium', 'hero', grammar)).toBe(
      'hero.split-image',
    );
  });

  it('testimonials sem rating usa prova social, não content.block', () => {
    const noRating = buildLeadBrief({ id: 'z', name: 'Clínica' });
    const grammar = grammarBriefFromLead(noRating, ['testimonials']);
    expect(coerceComponentId('', 'testimonials', grammar)).toBe(
      'social-proof.numbers',
    );
    expect(coerceComponentId('content.block', 'testimonials', grammar)).not.toBe(
      'content.block',
    );
  });

  it('aceita body e items nulos no content.block', () => {
    const props = sanitizeProps(
      'content.block',
      { title: 'Bloco', body: null, items: null },
      brief,
    );
    expect(props.body).toBe('');
    expect(props.items).toEqual([]);
  });

  it('substitui imagem fora do brief por foto permitida no hero', () => {
    const props = sanitizeProps(
      'hero.centered',
      { headline: 'Firma', image: '/images/secreta.png' },
      brief,
    );
    expect(props.image).toBe('/images/foto.jpg');
  });

  it('não injeta foto no hero tipográfico de marketing', () => {
    const props = sanitizeProps(
      'hero.marketing',
      { headline: 'Firma' },
      brief,
    );
    expect(props.image).toBeUndefined();
    expect(props.headline).toBe('Firma');
  });

  it('preenche social-proof.stats só com dados do brief', () => {
    const rated = buildLeadBrief({
      id: 'y',
      name: 'Firma',
      city: 'São Paulo',
      rating: 4.8,
      reviewCount: 12,
      phone: '11999999999',
    });
    const props = fillDeterministicProps('social-proof.stats', rated, {
      nav: [],
      primaryCta: primaryCtaFromBrief(rated),
    });
    expect(props?.items).toEqual([
      { value: '4.8', label: 'Avaliação' },
      { value: '12', label: 'Avaliações' },
      { value: 'São Paulo', label: 'Cidade' },
    ]);
  });

  it('parseia page spec mínimo', () => {
    const spec = parsePageSpec({
      version: 1,
      theme: {
        style: 'modern',
        paletteId: 'slate-teal',
        fontPairId: 'fraunces-source',
      },
      sections: [
        {
          id: 'hero',
          type: 'hero',
          component: 'hero.gradient',
          props: { headline: 'Firma' },
        },
      ],
    });
    expect(spec.sections[0].component).toBe('hero.gradient');
    expect(spec.features).toEqual([]);
  });

  it('não deixa o architect sobrescrever variante travada pelo usuário', () => {
    const grammar = grammarBriefFromLead(brief, ['hero', 'footer']);
    const architecture = resolveArchitecture(
      {
        sections: [
          { id: 'hero', component: 'hero.gradient', purpose: 'llm' },
          { id: 'footer', component: 'footer.minimal', purpose: 'llm' },
        ],
      },
      [
        {
          id: 'hero',
          type: 'hero',
          title: 'Hero',
          description: 'Abertura',
          component: 'hero.cinematic',
        },
        {
          id: 'footer',
          type: 'footer',
          title: 'Footer',
          description: 'Rodapé',
        },
      ],
      grammar,
    );
    expect(architecture.sections[0].component).toBe('hero.cinematic');
    expect(architecture.sections[1].component).toBe('footer.minimal');
  });

  it('marca hasVideo quando o brief tem MP4', () => {
    const withVideo = {
      ...brief,
      videos: [
        {
          filename: 'hero-1.mp4',
          publicPath: '/videos/hero-1.mp4',
          pexelsId: 1,
          photographer: 'Ana',
          photographerUrl: 'https://www.pexels.com/@ana',
          pageUrl: 'https://www.pexels.com/video/1/',
        },
      ],
    };
    expect(grammarBriefFromLead(withVideo).hasVideo).toBe(true);
    expect(grammarBriefFromLead(brief).hasVideo).toBe(false);
  });

  it('injeta vídeo local no cinematic e remove MP4 remoto', () => {
    const withVideo = {
      ...brief,
      videos: [
        {
          filename: 'hero-9.mp4',
          publicPath: '/videos/hero-9.mp4',
          pexelsId: 9,
          photographer: 'Ana',
          photographerUrl: 'https://www.pexels.com/@ana',
          pageUrl: 'https://www.pexels.com/video/9/',
        },
      ],
    };
    const props = sanitizeProps(
      'hero.cinematic',
      {
        headline: 'Firma',
        video: 'https://player.vimeo.com/external/x.mp4',
      },
      withVideo,
    );
    expect(props.video).toBe('/videos/hero-9.mp4');
    expect(props.image).toBe('/images/foto.jpg');
  });

  it('ativa mode video no immersive quando há stock', () => {
    const withVideo = {
      ...brief,
      videos: [
        {
          filename: 'hero-9.mp4',
          publicPath: '/videos/hero-9.mp4',
          pexelsId: 9,
          photographer: 'Ana',
          photographerUrl: 'https://www.pexels.com/@ana',
          pageUrl: 'https://www.pexels.com/video/9/',
        },
      ],
    };
    const props = sanitizeProps(
      'hero.immersive',
      { headline: 'Firma' },
      withVideo,
    );
    expect(props.video).toBe('/videos/hero-9.mp4');
    expect(props.mode).toBe('video');
  });

  it('injeta os dois vídeos e destaques no hero split-video', () => {
    const withVideo = {
      ...brief,
      videos: [
        {
          filename: 'hero-background.mp4',
          publicPath: '/videos/hero-background.mp4',
        },
        {
          filename: 'hero-portrait.mp4',
          publicPath: '/videos/hero-portrait.mp4',
        },
      ],
    };
    const props = sanitizeProps(
      'hero.split-video',
      { headline: 'Firma' },
      withVideo,
    );
    expect(props.video).toBe('/videos/hero-background.mp4');
    expect(props.portraitVideo).toBe('/videos/hero-portrait.mp4');
    expect(props.highlights).toEqual([{ label: 'Consultoria' }]);
  });

  it('aplica mídia atribuída no hero, galeria e navbar', () => {
    const media = {
      images: ['/images/hero.jpg', '/images/extra.jpg'],
      logo: '/images/logo.png',
      video: '/videos/hero-background.mp4',
      portraitVideo: '/videos/hero-portrait.mp4',
    };
    const hero = applyAssignedMedia(
      'hero.split-video',
      { headline: 'Firma' },
      media,
    );
    expect(hero.image).toBe('/images/hero.jpg');
    expect(hero.portraitImage).toBe('/images/extra.jpg');
    expect(hero.video).toBe('/videos/hero-background.mp4');
    expect(hero.portraitVideo).toBe('/videos/hero-portrait.mp4');

    const gallery = applyAssignedMedia(
      'gallery.grid',
      { title: 'Galeria', images: ['/images/foto.jpg'] },
      { images: ['/images/a.jpg', '/images/b.jpg'] },
    );
    expect(gallery.images).toEqual(['/images/a.jpg', '/images/b.jpg']);

    const navbar = applyAssignedMedia(
      'navbar.minimal',
      { brand: 'Firma' },
      { images: ['/images/marca.png'] },
    );
    expect(navbar.logo).toBe('/images/marca.png');

    const layout = applyAssignedMedia(
      'layout.split',
      { leftTitle: 'Sobre' },
      { images: ['/images/sala.jpg'] },
    );
    expect(layout.image).toBe('/images/sala.jpg');
  });

  it('mantém vídeo atribuído no cinematic em vez de sobrescrever com stock', () => {
    const withVideo = {
      ...brief,
      videos: [
        {
          filename: 'hero-9.mp4',
          publicPath: '/videos/hero-9.mp4',
        },
        {
          filename: 'hero-background.mp4',
          publicPath: '/videos/hero-background.mp4',
        },
      ],
    };
    const props = sanitizeProps(
      'hero.cinematic',
      {
        headline: 'Firma',
        video: '/videos/hero-background.mp4',
      },
      withVideo,
    );
    expect(props.video).toBe('/videos/hero-background.mp4');
  });
});
