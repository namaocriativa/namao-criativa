export const SITE_ORIGIN = 'https://namaocriativa.com.br';
export const SITE_NAME = 'Namão Criativa';
export const SITE_SHORT_NAME = 'Namão';
export const SITE_EMAIL = 'contato@namaocriativa.com.br';
export const SITE_PHONE = '+5519997306695';
export const SITE_PHONE_DISPLAY = '+55 19 99730-6695';
export const SITE_THEME_COLOR = '#050505';
export const SITE_OG_IMAGE = '/og.jpg';
export const SITE_LOGO = '/logo-mark.png';
export const SITE_HERO_POSTER = '/hero-poster.jpg';

/** Handle público sem @. Vazio = não gera link nem sameAs. */
export const INSTAGRAM_HANDLE = '';

export const WHATSAPP_PREFILL =
  'Olá! Vim pelo site da Namão Criativa e quero conversar.';

export const WHATSAPP_URL = `https://wa.me/5519997306695?text=${encodeURIComponent(WHATSAPP_PREFILL)}`;

export const AREA_CITIES = [
  'Leme',
  'Limeira',
  'Araras',
  'Pirassununga',
  'Campinas',
] as const;

export const SERVICES = [
  {
    slug: 'marketing',
    path: '/servicos/marketing',
    index: '01',
    name: 'Marketing',
    summary: 'Posicionamento, conteúdo e presença digital.',
  },
  {
    slug: 'software',
    path: '/servicos/software',
    index: '02',
    name: 'Software',
    summary: 'Sites, sistemas e ferramentas sob medida.',
  },
  {
    slug: 'chatbots',
    path: '/servicos/chatbots',
    index: '03',
    name: 'Chatbots',
    summary: 'Atendimento e captação no WhatsApp e na web.',
  },
  {
    slug: 'inteligencia-artificial',
    path: '/servicos/inteligencia-artificial',
    index: '04',
    name: 'Inteligência artificial',
    summary: 'Automação e geração com dados reais do seu negócio.',
  },
] as const;

export function absoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized === '/' ? '/' : normalized}`;
}

export function instagramUrl(): string | null {
  const handle = INSTAGRAM_HANDLE.replace(/^@/, '').trim();
  if (!handle) return null;
  return `https://www.instagram.com/${handle}/`;
}

export function gtmContainerId(raw?: string): string | null {
  const id = (raw || '').trim().toUpperCase();
  return /^GTM-[A-Z0-9]+$/.test(id) ? id : null;
}
