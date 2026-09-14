import { FAQ_ITEMS } from './faq';
import {
  AREA_CITIES,
  SITE_EMAIL,
  SITE_LOGO,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_PHONE,
  absoluteUrl,
  instagramUrl,
} from './site';

export type Breadcrumb = { name: string; path: string };

const ORG_ID = `${SITE_ORIGIN}/#organization`;
const SITE_ID = `${SITE_ORIGIN}/#website`;

function sameAs(): string[] {
  const ig = instagramUrl();
  return ig ? [ig] : [];
}

export function organizationNode() {
  const links = sameAs();
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE_NAME,
    url: SITE_ORIGIN,
    logo: absoluteUrl(SITE_LOGO),
    email: SITE_EMAIL,
    telephone: SITE_PHONE,
    ...(links.length > 0 ? { sameAs: links } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Leme',
      addressRegion: 'SP',
      addressCountry: 'BR',
    },
  };
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE_ORIGIN,
    name: SITE_NAME,
    inLanguage: 'pt-BR',
    publisher: { '@id': ORG_ID },
  };
}

export function professionalServiceNode() {
  return {
    '@type': 'ProfessionalService',
    '@id': `${SITE_ORIGIN}/#service`,
    name: SITE_NAME,
    url: SITE_ORIGIN,
    image: absoluteUrl('/og.jpg'),
    telephone: SITE_PHONE,
    email: SITE_EMAIL,
    areaServed: AREA_CITIES.map((name) => ({
      '@type': 'City',
      name,
      containedInPlace: { '@type': 'State', name: 'São Paulo' },
    })),
    knowsAbout: [
      'Marketing digital',
      'Criação de sites',
      'Chatbots',
      'Inteligência artificial',
    ],
    parentOrganization: { '@id': ORG_ID },
  };
}

export function homeGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [organizationNode(), websiteNode(), professionalServiceNode()],
  };
}

export function breadcrumbList(items: Breadcrumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqPageNode() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function serviceNode(opts: {
  name: string;
  path: string;
  description: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    url: absoluteUrl(opts.path),
    description: opts.description,
    provider: { '@id': ORG_ID },
    areaServed: AREA_CITIES.map((name) => ({ '@type': 'City', name })),
  };
}
