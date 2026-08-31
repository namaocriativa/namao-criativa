import { familyOf, type ComponentId } from '../ids';
import type { PageSpec } from '../spec/page-spec';
import { resolveTheme } from '../theme/resolve';

const heroBase = {
  eyebrow: 'São Paulo',
  headline: 'Estúdio Aurora',
  description: 'Projetos visuais com presença cinematográfica.',
  image:
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80',
  cta: { label: 'Falar agora', href: '#contact' },
};

const photos = [
  heroBase.image,
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
];

const navItems = [
  { label: 'Serviços', href: '#services' },
  { label: 'Sobre', href: '#about' },
  { label: 'Galeria', href: '#gallery' },
  { label: 'Contato', href: '#contact' },
];

function wordmark(label: string, bg: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="56" viewBox="0 0 180 56"><rect width="180" height="56" rx="10" fill="${bg}"/><text x="90" y="35" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#fff">${label}</text></svg>`;
  return {
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    alt: label,
  };
}

const mockLogos = [
  wordmark('Nova', '#1f2937'),
  wordmark('Atlas', '#0f766e'),
  wordmark('Lumen', '#4338ca'),
  wordmark('North', '#9a3412'),
  wordmark('Vivid', '#be185d'),
  wordmark('Orbit', '#334155'),
];

const mockQuotes = [
  {
    quote: 'O projeto ficou elegante e com a cara do estúdio. Entrega no prazo.',
    author: 'Marina Costa',
  },
  {
    quote: 'Processo claro, direção de arte forte e resultado que sustenta a marca.',
    author: 'Rafael Menezes',
  },
  {
    quote: 'Do briefing ao site, tudo com ritmo e cuidado. Recomendo.',
    author: 'Helena Prado',
  },
];

const mockServices = [
  'Direção de arte',
  'Identidade visual',
  'Sites e digital',
  'Fotografia',
  'Campanhas',
  'Consultoria de marca',
];

export const SAMPLE_PROPS: Partial<Record<ComponentId, Record<string, unknown>>> = {
  'navbar.minimal': {
    brand: 'Aurora',
    logo: wordmark('A', '#111827').src,
    nav: navItems,
    cta: heroBase.cta,
  },
  'navbar.centered': {
    brand: 'Aurora',
    nav: navItems,
    cta: heroBase.cta,
  },
  'navbar.premium': {
    brand: 'Aurora',
    logo: wordmark('A', '#111827').src,
    nav: navItems,
    cta: heroBase.cta,
  },
  'navbar.marketing': {
    brand: 'Aurora',
    nav: navItems,
    cta: heroBase.cta,
  },
  'navbar.overlay': {
    brand: 'Aurora',
    nav: [
      { label: 'Serviços', href: '#services' },
      { label: 'Sobre', href: '#about' },
      { label: 'Agendar', href: '#contact' },
      { label: 'Local', href: '#contact' },
      { label: 'Depoimentos', href: '#testimonials' },
    ],
    cta: { label: 'WhatsApp', href: 'https://wa.me/5511999999999' },
  },
  'hero.split-image': heroBase,
  'hero.centered': heroBase,
  'hero.full-image': heroBase,
  'hero.gradient': { ...heroBase, image: undefined },
  'hero.marketing': {
    headline: 'Presença visual com clareza e ritmo',
    description: 'Projetos, identidade e digital — tudo no mesmo lugar.',
    cta: { label: 'Começar agora', href: '#contact' },
    footnote: 'Atendimento em São Paulo.',
  },
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
  'hero.split-video': {
    ...heroBase,
    overlayOpacity: 0.58,
    portraitImage:
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80',
    portraitCaption: 'Dra. Carla Paixão',
    portraitSubcaption: 'CRO/SP 123369',
    highlights: [
      { label: 'Cuidado sem pressa', icon: 'heart' },
      { label: 'Estrutura moderna', icon: 'building' },
      { label: 'Profissionais qualificados', icon: 'people' },
      { label: 'Avaliações 5 estrelas', icon: 'star' },
    ],
  },
  'social-proof.logos': {
    title: 'Quem confia',
    logos: mockLogos,
  },
  'social-proof.numbers': {
    title: 'Avaliações',
    rating: 4.8,
    reviewCount: 120,
    caption: 'Google',
  },
  'social-proof.stats': {
    title: 'Presença',
    items: [
      { value: '4.8', label: 'Avaliação' },
      { value: '120', label: 'Avaliações' },
      { value: 'São Paulo', label: 'Cidade' },
    ],
  },
  'features.cards': {
    title: 'Serviços',
    subtitle: 'O que o estúdio entrega, do briefing à publicação.',
    items: mockServices,
  },
  'features.bento': {
    title: 'Serviços',
    subtitle: 'Um mosaico da oferta.',
    items: mockServices,
  },
  'features.alternating': {
    title: 'Serviços',
    subtitle: 'Cada frente com o mesmo cuidado.',
    items: mockServices.slice(0, 5),
  },
  'features.showcase': {
    title: 'Serviços',
    subtitle: 'Seleção da prática do estúdio.',
    items: mockServices,
  },
  'gallery.grid': { title: 'Galeria', images: photos },
  'gallery.masonry': { title: 'Galeria', images: photos },
  'gallery.carousel': { title: 'Trabalhos', images: photos },
  'about.split': {
    title: 'Sobre',
    body: 'Estúdio independente em São Paulo. Trabalhamos identidade, digital e direção de arte para marcas que querem presença com calma e precisão.',
    image: heroBase.image,
    rating: 4.8,
    reviewCount: 120,
  },
  'about.editorial': {
    title: 'Sobre',
    body: 'Estúdio independente em São Paulo. Projetos visuais com presença cinematográfica, do conceito ao site publicado.',
    rating: 4.8,
    reviewCount: 120,
  },
  'testimonials.cards': {
    title: 'Avaliações',
    rating: 4.8,
    reviewCount: 120,
    quotes: mockQuotes,
  },
  'testimonials.quotes': {
    title: 'Avaliações',
    rating: 4.8,
    reviewCount: 120,
    quotes: mockQuotes,
  },
  'faq.accordion': {
    title: 'Perguntas frequentes',
    subtitle: 'Respostas diretas sobre atendimento e processo.',
    items: [
      {
        question: 'Atendem presencialmente?',
        answer: 'Sim, em São Paulo, com horário combinado.',
      },
      {
        question: 'Qual o prazo médio de um projeto?',
        answer: 'Identidade e site costumam levar de quatro a oito semanas, conforme o escopo.',
      },
      {
        question: 'Trabalham com marcas de outros estados?',
        answer: 'Sim. O processo é remoto, com encontros por videochamada.',
      },
      {
        question: 'Como começa o briefing?',
        answer: 'Uma conversa inicial alinha objetivos, referências e o que já existe da marca.',
      },
    ],
  },
  'cta.banner': { title: 'Vamos conversar', cta: heroBase.cta },
  'cta.split': { title: 'Vamos conversar', cta: heroBase.cta, image: heroBase.image },
  'cta.dark': {
    title: 'Pronto para começar?',
    subtitle: 'Fale com o estúdio e alinhe o próximo projeto.',
    cta: { label: 'Falar agora', href: '#contact' },
    footnote: 'Atendimento em São Paulo.',
  },
  'contact.form': {
    title: 'Contato',
    subtitle: 'Escolha o canal. Respondemos em horário comercial.',
    links: [
      { label: 'WhatsApp', href: 'https://wa.me/5511999999999' },
      { label: 'E-mail', href: 'mailto:ola@aurora.test' },
      { label: 'Instagram', href: 'https://instagram.com/aurora' },
    ],
    address: 'Rua Augusta, 1500 — São Paulo, SP',
    cta: heroBase.cta,
  },
  'footer.minimal': { brand: 'Aurora', location: 'São Paulo' },
  'footer.premium': {
    brand: 'Aurora',
    location: 'São Paulo',
    nav: navItems,
    links: [
      { label: 'E-mail', href: 'mailto:ola@aurora.test' },
      { label: 'Instagram', href: 'https://instagram.com/aurora' },
    ],
  },
  'content.block': {
    title: 'Como trabalhamos',
    body: 'Um processo curto, com etapas visíveis e decisões no início — para a marca sair com ritmo e consistência.',
    items: ['Briefing e referências', 'Direção e testes visuais', 'Produção e publicação'],
    cta: heroBase.cta,
  },
  'layout.section': {
    title: 'Seção',
    body: 'Wrapper com padding e alinhamento para o restante da página.',
    align: 'start',
  },
  'layout.container': {
    title: 'Container',
    body: 'Largura máxima centralizada, com o mesmo ritmo tipográfico do tema.',
  },
  'layout.fullscreen': {
    title: 'Fullscreen',
    body: 'Ocupa a viewport para aberturas e capítulos visuais.',
    minHeight: '100vh',
  },
  'layout.split': {
    leftTitle: 'Esquerda',
    leftBody: 'Texto de apoio, serviço ou argumento.',
    rightTitle: 'Direita',
    rightBody: 'Imagem ou segundo bloco de leitura.',
    image: heroBase.image,
    ratio: '50-50',
  },
  'effects.glass-card': {
    title: 'Glass',
    body: 'Card translúcido com highlight que segue o cursor.',
  },
  'effects.glow': {
    title: 'Glow',
    body: 'Acento luminoso atrás do título.',
  },
  'effects.parallax': {
    title: 'Parallax',
    body: 'Camada que se desloca no scroll.',
    image: heroBase.image,
  },
  'effects.spotlight': {
    title: 'Spotlight',
    body: 'Luz que acompanha o mouse sobre o conteúdo.',
    image: photos[1],
  },
  'effects.noise': {
    title: 'Grain',
    body: 'Textura cinematográfica sobre o bloco.',
    image: photos[2],
  },
  'effects.scanline': {
    title: 'Scanline',
    body: 'Linhas tecnológicas opcionais no fundo.',
    image: photos[3],
  },
};

export function previewPageSpec(id: ComponentId, dark = false): PageSpec {
  const theme = resolveTheme({
    style: 'premium',
    paletteId: dark ? 'ink-gold' : 'slate-teal',
    fontPairId: 'fraunces-source',
    animation: 'cinematic',
  });
  const family = familyOf(id);
  const sections: PageSpec['sections'] = [
    {
      id: 'preview',
      type: family === 'hero' ? 'hero' : family === 'navbar' ? 'header' : 'custom',
      component: id,
      purpose: 'gallery',
      props: SAMPLE_PROPS[id] || {},
    },
  ];
  if (family === 'navbar') {
    const heroId = id === 'navbar.overlay' ? 'hero.cinematic' : 'hero.gradient';
    sections.push({
      id: 'hero',
      type: 'hero',
      component: heroId,
      purpose: 'gallery',
      props: SAMPLE_PROPS[heroId] || {},
    });
  }
  return {
    version: 1,
    theme,
    sections,
    overlays: [],
    features: [],
  };
}
