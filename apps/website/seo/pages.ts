import { breadcrumbList, faqPageNode, homeGraph, serviceNode } from './jsonld';
import { SITE_HERO_POSTER } from './site';

export type PageSeo = {
  file: string;
  path: string;
  title: string;
  description: string;
  noindex?: boolean;
  jsonLd?: unknown[];
  preloadImage?: string;
};

const crumbsHome = { name: 'Início', path: '/' };

export const SEO_PAGES: PageSeo[] = [
  {
    file: 'index.html',
    path: '/',
    title: 'Namão Criativa | Agência digital em Leme e região',
    description:
      'Namão Criativa — agência digital em Leme e região: marketing, sites, chatbots e inteligência artificial para negócios locais crescerem com clareza.',
    jsonLd: [homeGraph()],
    preloadImage: SITE_HERO_POSTER,
  },
  {
    file: 'sobre/index.html',
    path: '/sobre',
    title: 'Sobre a Namão Criativa | Agência digital em Leme',
    description:
      'Conheça a Namão Criativa: agência digital de Leme e região que une marketing, software, chatbots e IA. Não somos Namo nem NaMão Design — somos Namaocriativa.com.br.',
    jsonLd: [
      breadcrumbList([crumbsHome, { name: 'Sobre', path: '/sobre' }]),
    ],
  },
  {
    file: 'servicos/index.html',
    path: '/servicos',
    title: 'Serviços | Namão Criativa — agência digital em Leme',
    description:
      'Marketing, criação de sites, chatbots de WhatsApp e inteligência artificial para negócios de Leme, Limeira, Araras, Pirassununga e região de Campinas.',
    jsonLd: [
      breadcrumbList([crumbsHome, { name: 'Serviços', path: '/servicos' }]),
    ],
  },
  {
    file: 'servicos/marketing/index.html',
    path: '/servicos/marketing',
    title: 'Marketing digital em Leme | Namão Criativa',
    description:
      'Posicionamento, conteúdo e presença digital para negócios de Leme e região. A Namão Criativa cuida da sua marca para você aparecer com clareza.',
    jsonLd: [
      breadcrumbList([
        crumbsHome,
        { name: 'Serviços', path: '/servicos' },
        { name: 'Marketing', path: '/servicos/marketing' },
      ]),
      serviceNode({
        name: 'Marketing digital',
        path: '/servicos/marketing',
        description:
          'Posicionamento, conteúdo e presença digital para negócios locais.',
      }),
    ],
  },
  {
    file: 'servicos/software/index.html',
    path: '/servicos/software',
    title: 'Criação de sites em Leme | Namão Criativa',
    description:
      'Sites e sistemas sob medida para negócios de Leme e região. A Namão Criativa entrega presença digital profissional, pronta para receber contatos.',
    jsonLd: [
      breadcrumbList([
        crumbsHome,
        { name: 'Serviços', path: '/servicos' },
        { name: 'Software', path: '/servicos/software' },
      ]),
      serviceNode({
        name: 'Sites e software',
        path: '/servicos/software',
        description: 'Sites, sistemas e ferramentas sob medida.',
      }),
    ],
  },
  {
    file: 'servicos/chatbots/index.html',
    path: '/servicos/chatbots',
    title: 'Chatbot WhatsApp em Leme | Namão Criativa',
    description:
      'Atendimento e captação no WhatsApp e na web para negócios de Leme e região. Chatbots da Namão Criativa com a voz do seu negócio.',
    jsonLd: [
      breadcrumbList([
        crumbsHome,
        { name: 'Serviços', path: '/servicos' },
        { name: 'Chatbots', path: '/servicos/chatbots' },
      ]),
      serviceNode({
        name: 'Chatbots',
        path: '/servicos/chatbots',
        description: 'Atendimento e captação no WhatsApp e na web.',
      }),
    ],
  },
  {
    file: 'servicos/inteligencia-artificial/index.html',
    path: '/servicos/inteligencia-artificial',
    title: 'Inteligência artificial para negócios em Leme | Namão Criativa',
    description:
      'Automação e geração com dados reais do seu negócio. IA da Namão Criativa para empresas de Leme e região — sem texto genérico.',
    jsonLd: [
      breadcrumbList([
        crumbsHome,
        { name: 'Serviços', path: '/servicos' },
        { name: 'Inteligência artificial', path: '/servicos/inteligencia-artificial' },
      ]),
      serviceNode({
        name: 'Inteligência artificial',
        path: '/servicos/inteligencia-artificial',
        description: 'Automação e geração com dados reais do negócio.',
      }),
    ],
  },
  {
    file: 'cases/index.html',
    path: '/cases',
    title: 'Cases | Namão Criativa em Leme',
    description:
      'Quem já constrói com a Namão Criativa: Paulinho Cabelos e Maluna, negócios de Leme/SP com presença digital profissional.',
    jsonLd: [
      breadcrumbList([crumbsHome, { name: 'Cases', path: '/cases' }]),
    ],
  },
  {
    file: 'faq/index.html',
    path: '/faq',
    title: 'Perguntas frequentes | Namão Criativa',
    description:
      'Dúvidas sobre a Namão Criativa: serviços, conta, Instagram, site do negócio e WhatsApp. Agência digital em Leme e região.',
    jsonLd: [
      breadcrumbList([crumbsHome, { name: 'FAQ', path: '/faq' }]),
      faqPageNode(),
    ],
  },
  {
    file: 'termos.html',
    path: '/termos.html',
    title: 'Termos de uso — Namão Criativa',
    description:
      'Termos de uso da Namão Criativa: conta, chat, Instagram, sites e painel.',
  },
  {
    file: 'privacidade.html',
    path: '/privacidade.html',
    title: 'Política de privacidade — Namão Criativa',
    description:
      'Política de privacidade da Namão Criativa: quais dados usamos, para quê e como exercer seus direitos (LGPD).',
  },
  {
    file: 'login.html',
    path: '/login.html',
    title: 'Entrar — Namão Criativa',
    description: 'Acesse sua conta na Namão Criativa.',
    noindex: true,
  },
  {
    file: 'register.html',
    path: '/register.html',
    title: 'Criar conta — Namão Criativa',
    description: 'Crie sua conta na Namão Criativa com nome, e-mail e Instagram do negócio.',
    noindex: true,
  },
  {
    file: 'dashboard.html',
    path: '/dashboard.html',
    title: 'Painel — Namão Criativa',
    description: 'Painel do cliente Namão Criativa.',
    noindex: true,
  },
  {
    file: 'conectar.html',
    path: '/conectar.html',
    title: 'Conectar Instagram — Namão Criativa',
    description: 'Autorize o Instagram do negócio na Namão Criativa.',
    noindex: true,
  },
];

export const INDEXABLE_PAGES = SEO_PAGES.filter((page) => !page.noindex);

export function matchSeoPage(filename: string, urlPath?: string): PageSeo | undefined {
  const candidates = [filename, urlPath || '']
    .filter(Boolean)
    .map((value) => value.replace(/\\/g, '/'));

  const ranked = [...SEO_PAGES].sort((a, b) => b.file.length - a.file.length);
  for (const page of ranked) {
    for (const candidate of candidates) {
      if (
        candidate === page.file ||
        candidate === `/${page.file}` ||
        candidate.endsWith(`/${page.file}`)
      ) {
        return page;
      }
      const pretty = candidate.replace(/\/index\.html$/i, '').replace(/\/+$/, '') || '/';
      if (pretty === page.path) return page;
    }
  }
  return undefined;
}

export function viteInput(): Record<string, string> {
  const input: Record<string, string> = {};
  for (const page of SEO_PAGES) {
    const key = page.file.replace(/\.html$/, '').replaceAll('/', '-');
    input[key || 'main'] = page.file;
  }
  return input;
}
