/**
 * Rules for deciding whether a URL is the business' own site, versus a
 * directory, marketplace, social profile or unrelated search hit.
 */

const BLOCKED_HOSTS = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'pinterest.com',
  'wa.me',
  'whatsapp.com',
  'google.com',
  'google.com.br',
  'goo.gl',
  'maps.app.goo.gl',
  'bing.com',
  'duckduckgo.com',
  'wikipedia.org',
  'jusbrasil.com.br',
  'reclameaqui.com.br',
  'glassdoor.com',
  'glassdoor.com.br',
  'indeed.com',
  'econodata.com.br',
  'cnpj.biz',
  'cnpja.com',
  'consultacnpj.com',
  'casadosdados.com.br',
  'guiamais.com.br',
  'apontador.com.br',
  'telelistas.net',
  'solutudo.com.br',
  'cylex.com.br',
  'locaisdobrasil.com.br',
  'todosnegocios.com',
  'migalhas.com.br',
  'encontraadvogados.com.br',
  'oab.org.br',
  'medium.com',
  'yelp.com',
  'foursquare.com',
  'tripadvisor.com',
  'tripadvisor.com.br',
  'restaurantguru.com',
  'restaurantguru.com.br',
  'ifood.com.br',
  'rappi.com',
  'rappi.com.br',
  'ubereats.com',
  'uber.com',
  'thefork.com',
  'thefork.com.br',
  'zomato.com',
  'zomato.com.br',
  'aiqfome.com',
  'aiqfome.com.br',
  'anota.ai',
  'goomer.app',
  'goomer.com.br',
  'menudino.com',
  'linktr.ee',
  'linktree.com',
  'booking.com',
  'airbnb.com',
  'waze.com',
];

const STOPWORDS = new Set([
  'advocacia',
  'advogados',
  'advogado',
  'sociedade',
  'associados',
  'escritorio',
  'ltda',
  'eireli',
  'padaria',
  'panificadora',
  'confeitaria',
  'restaurante',
  'lanchonete',
  'pizzaria',
  'churrascaria',
  'sorveteria',
  'acaiteria',
  'hamburgueria',
  'cafeteria',
  'mercearia',
  'mercado',
  'supermercado',
  'farmacia',
  'drogaria',
  'comercio',
  'empresa',
  'clinica',
  'consultorio',
  'hospital',
  'hotel',
  'pousada',
  'escola',
  'colegio',
  'oficina',
  'academia',
  'salao',
  'barbearia',
  'petshop',
]);

export function hostnameOf(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

export function isBlockedHost(host: string): boolean {
  const normalized = host.replace(/^www\./i, '').toLowerCase();
  return BLOCKED_HOSTS.some(
    (blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`),
  );
}

export function isBlockedWebsite(value: string | null | undefined): boolean {
  const host = hostnameOf(value);
  return Boolean(host && isBlockedHost(host));
}

export function normalizeCandidateWebsite(raw: string | null): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (isBlockedHost(host)) return null;

  return `${url.protocol}//${url.hostname}/`;
}

export function tokenizeBusinessName(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

export function hostMatchesBusinessName(host: string, nameTokens: string[]): boolean {
  if (!nameTokens.length) return false;
  return nameTokens.some((token) => host.includes(token));
}

export function scoreWebsiteCandidate(url: string, nameTokens: string[]): number {
  const host = hostnameOf(url);
  if (!host) return 0;
  const label = host.split('.')[0] ?? '';
  let score = 0;

  for (const token of nameTokens) {
    if (label.includes(token)) score += 3;
    else if (host.includes(token)) score += 1;
  }

  if (host.endsWith('.com.br') || host.endsWith('.adv.br')) score += 1;
  if (host.endsWith('.com')) score += 0.5;

  return score;
}

/**
 * Picks an official website from search hits. Returns null unless a candidate
 * domain actually contains a distinctive token from the business name.
 */
export function selectOfficialWebsite(
  candidateUrls: string[],
  businessName: string,
): string | null {
  const nameTokens = tokenizeBusinessName(businessName);
  if (!nameTokens.length) return null;

  const seen = new Set<string>();
  const ranked: Array<{ url: string; score: number }> = [];

  candidateUrls.forEach((raw, index) => {
    const url = normalizeCandidateWebsite(raw);
    if (!url) return;
    const host = hostnameOf(url);
    if (!host || seen.has(host)) return;
    seen.add(host);
    if (!hostMatchesBusinessName(host, nameTokens)) return;
    ranked.push({
      url,
      score: scoreWebsiteCandidate(url, nameTokens) - index * 0.1,
    });
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.url ?? null;
}
