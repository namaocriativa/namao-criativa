export const OFFER_TEMPLATE_ID = 'default';

export const DEFAULT_OFFER_TEMPLATE = {
  emailSubject: '{{package.name}} para {{lead.name}} — Namão Criativa',
  emailBody: [
    'Olá, {{lead.name}}.',
    '',
    'Preparei uma proposta da Namão Criativa para o seu negócio.',
    '',
    '{{package.name}}',
    '{{package.priceLine}}',
    '',
    '{{package.summary}}',
    '',
    '{{package.description}}',
    '',
    'O que está incluso:',
    '{{package.benefits}}',
    '',
    'Se fizer sentido, responda este e-mail e combinamos o próximo passo.',
    '',
    'Namão Criativa',
  ].join('\n'),
  whatsappMessage: [
    'Olá, {{lead.name}}.',
    '',
    'Tenho uma proposta da Namão Criativa para o seu negócio:',
    '',
    '*{{package.name}}*',
    '{{package.priceLine}}',
    '',
    '{{package.summary}}',
    '',
    '{{package.benefits}}',
    '',
    'Se quiser, te envio os detalhes.',
  ].join('\n'),
};

export type OfferPackageInput = {
  name: string;
  summary?: string | null;
  description?: string | null;
  benefits?: unknown;
  price?: number | null;
  promoPrice?: number | null;
  currency?: string | null;
};

export type OfferTemplateFields = {
  emailSubject: string;
  emailBody: string;
  whatsappMessage: string;
};

export type RenderedOffer = {
  subject: string;
  emailBody: string;
  whatsappMessage: string;
  vars: Record<string, string>;
};

export function formatOfferMoney(
  price: number | null | undefined,
  currency?: string | null,
): string | null {
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

export function offerPriceLine(pkg: OfferPackageInput): string {
  const full = formatOfferMoney(pkg.price, pkg.currency);
  const promo = formatOfferMoney(pkg.promoPrice, pkg.currency);
  if (full && promo) return `de ${full} por ${promo}`;
  return full || 'Sob consulta';
}

export function offerBenefitsText(benefits: unknown): string {
  if (!Array.isArray(benefits)) return '';
  return benefits
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => `• ${item}`)
    .join('\n');
}

export function offerVars(
  leadName: string,
  pkg: OfferPackageInput,
): Record<string, string> {
  return {
    'lead.name': leadName.trim() || 'olá',
    'package.name': pkg.name.trim(),
    'package.summary': pkg.summary?.trim() || '',
    'package.description': pkg.description?.trim() || '',
    'package.benefits': offerBenefitsText(pkg.benefits),
    'package.price': formatOfferMoney(pkg.price, pkg.currency) || '',
    'package.promoprice': formatOfferMoney(pkg.promoPrice, pkg.currency) || '',
    'package.priceline': offerPriceLine(pkg),
  };
}

export function interpolateOffer(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-z0-9.]+)\s*\}\}/gi, (_, raw: string) => {
    const value = vars[raw.trim().toLowerCase()];
    return value == null ? '' : value;
  });
}

export function collapseOfferBlankLines(value: string): string {
  return value
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function withOfferDefaults(
  template?: Partial<OfferTemplateFields> | null,
): OfferTemplateFields {
  return {
    emailSubject:
      template?.emailSubject?.trim() || DEFAULT_OFFER_TEMPLATE.emailSubject,
    emailBody: template?.emailBody?.trim() || DEFAULT_OFFER_TEMPLATE.emailBody,
    whatsappMessage:
      template?.whatsappMessage?.trim() ||
      DEFAULT_OFFER_TEMPLATE.whatsappMessage,
  };
}

export function renderOfferTemplate(
  template: Partial<OfferTemplateFields> | null | undefined,
  leadName: string,
  pkg: OfferPackageInput,
): RenderedOffer {
  const source = withOfferDefaults(template);
  const vars = offerVars(leadName, pkg);
  return {
    subject: collapseOfferBlankLines(interpolateOffer(source.emailSubject, vars)),
    emailBody: collapseOfferBlankLines(interpolateOffer(source.emailBody, vars)),
    whatsappMessage: collapseOfferBlankLines(
      interpolateOffer(source.whatsappMessage, vars),
    ),
    vars,
  };
}
