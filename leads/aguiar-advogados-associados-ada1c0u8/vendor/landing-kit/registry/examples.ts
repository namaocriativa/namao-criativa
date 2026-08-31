import { familyOf, type ComponentId } from '../ids';
import type { PageSpec } from '../spec/page-spec';
import { resolveTheme } from '../theme/resolve';

const heroBase = {
  eyebrow: 'São Paulo',
  headline: 'Estúdio Aurora',
  description: 'Projetos visuais com presença cinematográfica.',
  image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80',
  cta: { label: 'Falar agora', href: '#contact' },
};

export const SAMPLE_PROPS: Partial<Record<ComponentId, Record<string, unknown>>> = {
  'navbar.minimal': { brand: 'Aurora', nav: [{ label: 'Sobre', href: '#about' }], cta: heroBase.cta },
  'navbar.centered': { brand: 'Aurora', nav: [{ label: 'Sobre', href: '#about' }], cta: heroBase.cta },
  'navbar.premium': { brand: 'Aurora', nav: [{ label: 'Sobre', href: '#about' }], cta: heroBase.cta },
  'hero.split-image': heroBase,
  'hero.centered': heroBase,
  'hero.full-image': heroBase,
  'hero.gradient': { ...heroBase, image: undefined },
  'hero.cinematic': { ...heroBase, overlayOpacity: 0.5, mouseParallax: true },
  'hero.morphing': {
    headline: 'Aurora cria',
    words: ['experiências', 'presença', 'ritmo'],
    mode: 'fade',
    description: heroBase.description,
    cta: heroBase.cta,
  },
  'hero.split': { ...heroBase, side: 'image-right' },
  'hero.interactive': { ...heroBase, magnetic: true },
  'hero.product': { ...heroBase, screenshot: heroBase.image, device: 'browser' },
  'hero.immersive': { ...heroBase, mode: 'particles' },
  'social-proof.logos': { title: 'Quem confia', logos: [] },
  'social-proof.numbers': { title: 'Avaliações', rating: 4.8, reviewCount: 120, caption: 'Google' },
  'features.cards': { title: 'Serviços', items: ['Direção de arte', 'Identidade', 'Digital'] },
  'features.bento': { title: 'Serviços', items: ['Direção de arte', 'Identidade', 'Digital'] },
  'features.alternating': { title: 'Serviços', items: ['Direção de arte', 'Identidade', 'Digital'] },
  'gallery.grid': { title: 'Galeria', images: [heroBase.image] },
  'gallery.masonry': { title: 'Galeria', images: [heroBase.image] },
  'about.split': { title: 'Sobre', body: 'Estúdio independente em São Paulo.', image: heroBase.image },
  'about.editorial': { title: 'Sobre', body: 'Estúdio independente em São Paulo.' },
  'testimonials.cards': { title: 'Avaliações', rating: 4.8, reviewCount: 120, quotes: [] },
  'testimonials.quotes': { title: 'Avaliações', rating: 4.8, reviewCount: 120, quotes: [] },
  'faq.accordion': {
    title: 'Perguntas',
    items: [{ question: 'Atendem presencialmente?', answer: 'Sim, em São Paulo.' }],
  },
  'cta.banner': { title: 'Vamos conversar', cta: heroBase.cta },
  'cta.split': { title: 'Vamos conversar', cta: heroBase.cta, image: heroBase.image },
  'contact.form': {
    title: 'Contato',
    links: [{ label: 'E-mail', href: 'mailto:ola@aurora.test' }],
    address: 'São Paulo',
  },
  'footer.minimal': { brand: 'Aurora', location: 'São Paulo' },
  'footer.premium': {
    brand: 'Aurora',
    location: 'São Paulo',
    nav: [{ label: 'Sobre', href: '#about' }],
    links: [{ label: 'E-mail', href: 'mailto:ola@aurora.test' }],
  },
  'content.block': { title: 'Bloco', body: 'Conteúdo fechado.', items: [] },
  'layout.section': { title: 'Seção', body: 'Wrapper com padding e alinhamento.', align: 'start' },
  'layout.container': { title: 'Container', body: 'Largura máxima centralizada.' },
  'layout.fullscreen': { title: 'Fullscreen', body: 'Ocupa a viewport.', minHeight: '100vh' },
  'layout.split': {
    leftTitle: 'Esquerda',
    leftBody: 'Texto',
    rightTitle: 'Direita',
    image: heroBase.image,
    ratio: '50-50',
  },
  'effects.glass-card': { title: 'Glass', body: 'Card translúcido com highlight.' },
  'effects.glow': { title: 'Glow', body: 'Acento luminoso.' },
  'effects.parallax': { title: 'Parallax', body: 'Camada com scroll.', image: heroBase.image },
  'effects.spotlight': { title: 'Spotlight', body: 'Segue o cursor.' },
  'effects.noise': { title: 'Grain', body: 'Textura cinematográfica.' },
  'effects.scanline': { title: 'Scanline', body: 'Linhas tecnológicas.' },
};

export function previewPageSpec(id: ComponentId, dark = false): PageSpec {
  const theme = resolveTheme({
    style: 'premium',
    paletteId: dark ? 'ink-gold' : 'slate-teal',
    fontPairId: 'fraunces-source',
    animation: 'cinematic',
  });
  return {
    version: 1,
    theme,
    sections: [
      {
        id: 'preview',
        type: familyOf(id) === 'hero' ? 'hero' : 'custom',
        component: id,
        purpose: 'gallery',
        props: SAMPLE_PROPS[id] || {},
      },
    ],
    overlays: [],
  };
}
