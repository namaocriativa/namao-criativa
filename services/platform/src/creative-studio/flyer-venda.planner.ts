import type { LeadBrief } from '../landing/pipeline.types';
import { FLYER_VENDA_LANDING_ID } from './creative-features';

export type FlyerPackageInput = {
  id: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  price?: number | null;
  promoPrice?: number | null;
  currency?: string | null;
  benefits?: string[] | null;
};

export type FlyerPackageCard = {
  label: string;
  title: string;
  subtitle: string;
  bullets: string[];
  priceFrom: string | null;
  priceTo: string;
  savings: string | null;
};

export type FlyerSpec = {
  kicker: string;
  headline: string;
  subhead: string;
  intro: string;
  audienceNoun: string;
  packages: FlyerPackageCard[];
  footerBenefits: string[];
  cta: string;
  closingLine: string;
  layoutNotes: string;
};

export type FlyerPlannerContext = {
  brief: LeadBrief;
  packages: FlyerPackageInput[];
  notes: string;
  photoCount: number;
};

const MAX_PACKAGES = 2;
const MAX_BULLETS = 4;
const MAX_FOOTER = 4;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  const next = String(value).trim();
  return next || fallback;
}

function textList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => text(item))
    .filter(Boolean)
    .slice(0, max);
}

function moneyLabel(price: number | null | undefined, currency?: string | null) {
  if (price == null || !Number.isFinite(price)) return null;
  const code = (currency || 'BRL').toUpperCase();
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: code,
    }).format(price);
  } catch {
    return `${code} ${price}`;
  }
}

export function audienceNounFromCategory(category: string | null | undefined): string {
  const value = (category || '').toLowerCase();
  if (
    /dent|odonto|cl[ií]nic|m[eé]dic|sa[uú]de|psico|fisiot|nutri|est[eé]tic/.test(
      value,
    )
  ) {
    return 'pacientes';
  }
  if (/advog|direito|jur[ií]d/.test(value)) return 'clientes';
  if (/im[oó]ve|corretor/.test(value)) return 'compradores';
  return 'clientes';
}

export function parseFlyerSpec(value: unknown, fallback: FlyerPlannerContext): FlyerSpec {
  const raw = asRecord(value) || {};
  const audienceNoun =
    text(raw.audienceNoun) || audienceNounFromCategory(fallback.brief.category);
  const packagesFromModel = Array.isArray(raw.packages)
    ? raw.packages
        .map((item, index) => parsePackageCard(item, fallback.packages[index], index))
        .filter((item): item is FlyerPackageCard => Boolean(item))
        .slice(0, MAX_PACKAGES)
    : [];
  const packages = packagesFromModel.length
    ? packagesFromModel
    : fallback.packages.map((pkg, index) => fallbackPackageCard(pkg, index));

  if (!packages.length) {
    throw new Error('O planner do flyer precisa de ao menos um pacote');
  }

  const kicker = text(
    raw.kicker,
    [fallback.brief.category, fallback.brief.name].filter(Boolean).join(' · '),
  );
  const headline = text(
    raw.headline,
    `Sua presença digital pode trabalhar por você.`,
  );
  const subhead = text(
    raw.subhead,
    `Mais visibilidade, mais ${audienceNoun}.`,
  );
  const intro = text(
    raw.intro,
    `A Namão Criativa é a agência que entende o momento de ${fallback.brief.name} e ajuda a conquistar mais ${audienceNoun}, com estratégias digitais personalizadas e focadas em resultados.`,
  );

  return {
    kicker,
    headline,
    subhead,
    intro,
    audienceNoun,
    packages,
    footerBenefits: textList(raw.footerBenefits, MAX_FOOTER).length
      ? textList(raw.footerBenefits, MAX_FOOTER)
      : ['Mais visibilidade', 'Mais autoridade', 'Mais agilidade', `Mais ${audienceNoun}`],
    cta: text(raw.cta, 'Fale com a gente'),
    closingLine: text(
      raw.closingLine,
      `Seu negócio no digital, com quem entende de estratégia.`,
    ),
    layoutNotes: text(
      raw.layoutNotes,
      'Fundo preto, neon magenta/ciano/laranja, logo Namão no topo, foto circular do lead, dois cards de pacote, CTA em pílula.',
    ),
  };
}

function parsePackageCard(
  value: unknown,
  input: FlyerPackageInput | undefined,
  index: number,
): FlyerPackageCard | null {
  const raw = asRecord(value);
  if (!raw && !input) return null;
  const fallback = input ? fallbackPackageCard(input, index) : null;
  const title = text(raw?.title, fallback?.title || `Pacote ${index + 1}`);
  if (!title) return null;
  return {
    label: text(raw?.label, fallback?.label || `PACOTE ${roman(index + 1)}`),
    title,
    subtitle: text(raw?.subtitle, fallback?.subtitle || ''),
    bullets: textList(raw?.bullets, MAX_BULLETS).length
      ? textList(raw?.bullets, MAX_BULLETS)
      : fallback?.bullets || [],
    priceFrom: nullableText(raw?.priceFrom, fallback?.priceFrom ?? null),
    priceTo: text(raw?.priceTo, fallback?.priceTo || 'Sob consulta'),
    savings: nullableText(raw?.savings, fallback?.savings ?? null),
  };
}

function fallbackPackageCard(
  input: FlyerPackageInput,
  index: number,
): FlyerPackageCard {
  const benefits = Array.isArray(input.benefits)
    ? input.benefits.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const full = moneyLabel(input.price, input.currency);
  const promo = moneyLabel(input.promoPrice, input.currency);
  const hasPromo =
    input.promoPrice != null &&
    input.price != null &&
    Number(input.promoPrice) < Number(input.price);
  const savings = hasPromo
    ? `ECONOMIA DE ${Math.round((1 - Number(input.promoPrice) / Number(input.price)) * 100)}%`
    : null;
  return {
    label: `PACOTE ${roman(index + 1)}`,
    title: input.name,
    subtitle: text(input.summary),
    bullets: benefits.slice(0, MAX_BULLETS),
    priceFrom: hasPromo ? full : null,
    priceTo: (hasPromo ? promo : full) || 'Sob consulta',
    savings,
  };
}

function nullableText(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  if (value === undefined) return fallback;
  const next = String(value).trim();
  return next || null;
}

function roman(value: number): string {
  return ['I', 'II', 'III'][value - 1] || String(value);
}

export function buildFlyerPlannerPrompt(context: FlyerPlannerContext): string {
  const { brief, packages, notes, photoCount } = context;
  const packageBlock = packages
    .map((pkg, index) => {
      const benefits = Array.isArray(pkg.benefits)
        ? pkg.benefits.map((item) => `- ${item}`).join('\n')
        : '-';
      const price = moneyLabel(pkg.price, pkg.currency) || 'sem preço cadastrado';
      const promo = moneyLabel(pkg.promoPrice, pkg.currency);
      return `Pacote ${index + 1} (${pkg.id})
Nome: ${pkg.name}
Resumo: ${pkg.summary || '—'}
Descrição: ${pkg.description || '—'}
Preço cadastrado: ${price}
Preço promocional: ${promo || '—'}
Benefícios:
${benefits}`;
    })
    .join('\n\n');

  return `Você é o diretor de arte e copywriter da Namão Criativa.
Monte o copy de um FLYER DE VENDA da agência PARA o lead (a Namão vende site/pacote para essa pessoa/negócio).
Não crie um flyer do negócio do lead. A marca protagonista é Namão Criativa.

Responda APENAS um JSON com este shape:
{
  "kicker": "linha pequena acima do título, ex. DRA. NICOLE BARBOSA",
  "headline": "título forte em português",
  "subhead": "frase de reforço curta",
  "intro": "1 parágrafo apresentando a Namão para este lead",
  "audienceNoun": "pacientes|clientes|alunos|...",
  "packages": [
    {
      "label": "PACOTE I",
      "title": "nome do pacote",
      "subtitle": "linha de apoio",
      "bullets": ["benefício 1", "benefício 2", "benefício 3"],
      "priceFrom": "R$ 1.200" | null,
      "priceTo": "R$ 800",
      "savings": "ECONOMIA DE 33%" | null
    }
  ],
  "footerBenefits": ["Mais visibilidade", "Mais autoridade", "Mais agilidade", "Mais pacientes"],
  "cta": "Fale com a gente",
  "closingLine": "frase de fechamento",
  "layoutNotes": "notas curtas de layout"
}

Regras:
- Português do Brasil, tom sofisticado e direto.
- Vocabulário do nicho: se for saúde/clínica/odontologia use "pacientes"; senão o substantivo adequado.
- Use 1 ou 2 pacotes, na ordem recebida.
- Preços: se as notas trouxerem de/por, desconto ou economia, copie os valores exatamente (não invente).
- Se o pacote tiver preço promocional cadastrado, use-o em priceFrom/priceTo mesmo sem notas.
- Se não houver preço promocional nas notas nem no cadastro, priceFrom=null e priceTo=preço cadastrado (ou "Sob consulta").
- Não invente WhatsApp, CNPJ, endereço da Namão nem depoimentos.
- Não descreva outra pessoa além do lead.
- headline e textos visíveis devem caber num flyer A4/Instagram (frases curtas).
- Feature id: ${FLYER_VENDA_LANDING_ID}

LEAD
Nome: ${brief.name}
Categoria: ${brief.category || 'não informado'}
Cidade: ${[brief.city, brief.state].filter(Boolean).join(' / ') || 'não informado'}
Descrição: ${brief.description || '—'}
Serviços: ${(brief.services || []).join(', ') || '—'}
Fotos anexadas na geração: ${photoCount}

PACOTES
${packageBlock}

NOTAS DO OPERADOR
${notes.trim() || '(nenhuma nota extra)'}
`;
}

export function buildFlyerImagePrompt(spec: FlyerSpec): string {
  const packageBlock = spec.packages
    .map((pkg, index) => {
      const prices = [
        pkg.priceFrom ? `DE ${pkg.priceFrom}` : null,
        `POR ${pkg.priceTo}`,
        pkg.savings,
      ]
        .filter(Boolean)
        .join(' · ');
      const bullets = pkg.bullets.map((item) => `• ${item}`).join('\n');
      return `CARD ${index + 1} (${index === 0 ? 'esquerda' : 'direita'})
${pkg.label}
${pkg.title}
${pkg.subtitle}
${bullets}
${prices}`;
    })
    .join('\n\n');

  const quoted = (value: string) => `"${value.replace(/"/g, "'")}"`;

  return `Create a premium vertical sales flyer for Namão Criativa selling digital packages TO this lead. Photorealistic graphic design, not a mockup on a table.

LOCKED STRINGS — print these Brazilian Portuguese texts EXACTLY, with correct accents. Do not add extra prices, names, or testimonials.

Brand lockup (top-left): Namão Criativa
Tagline under logo: MARKETING · SITES · AUTOMAÇÃO · RESULTADOS
Kicker: ${quoted(spec.kicker)}
Headline: ${quoted(spec.headline)}
Accent script near the photo: ${quoted(spec.subhead)}
Intro: ${quoted(spec.intro)}
CTA pill: ${quoted(spec.cta)}
Closing: ${quoted(spec.closingLine)}
Footer icons: ${spec.footerBenefits.map(quoted).join(' | ')}

${packageBlock}

VISUAL SYSTEM
- Full-bleed dark black background, cinematic neon magenta / cyan / orange strokes and bokeh orbs (Namão identity).
- Attached logo is the Namão mark; place it top-left and again near the footer.
- Attached photo is ONLY the lead. Circular portrait, top-right. Do not invent another face. If no photo is attached, use a tasteful abstract neon portrait placeholder, not a random person.
- Two rounded glass cards with neon borders for the packages.
- Bold modern sans type, high contrast, print-ready.
- Portrait 2:3 poster, plenty of margin, no screenshot chrome, no QR unless provided.
- Layout notes: ${spec.layoutNotes}
`;
}

export const FLYER_SYSTEM_INSTRUCTION = `You are Namão Criativa's in-house art generator.
Always produce a sales flyer of the AGENCY (Namão Criativa) addressed to the lead — never a flyer for the lead's own brand.
Visual identity: black background, neon magenta, cyan and orange glow, circular lead portrait, Namão logo, two package cards, WhatsApp-style pill CTA.
Typography must be sharp. Copy in the user prompt is sacred: print it exactly in Brazilian Portuguese.
Do not copy celebrity faces or any reference person other than the attached lead photo.
Do not render watermarks, UI browsers, or fake QR codes.`;
