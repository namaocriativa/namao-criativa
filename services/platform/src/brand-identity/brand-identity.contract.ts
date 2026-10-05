export const DEFAULT_LOGO_APPEARANCE =
  'canto inferior direito, discreto, ~8% da largura';

export type BrandIdentity = {
  logoImageId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  headingFont?: string;
  bodyFont?: string;
  voice?: string;
  logoAppearance?: string;
};

const HEX = /^#([0-9a-fA-F]{6})$/;
const MAX_FONT = 80;
const MAX_VOICE = 240;
const MAX_APPEARANCE = 400;

export function parseBrandIdentity(raw: unknown): BrandIdentity {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const next: BrandIdentity = {};
  const logoImageId = clean(src.logoImageId, 64);
  if (logoImageId) next.logoImageId = logoImageId;
  const primaryColor = hexColor(src.primaryColor);
  if (primaryColor) next.primaryColor = primaryColor;
  const secondaryColor = hexColor(src.secondaryColor);
  if (secondaryColor) next.secondaryColor = secondaryColor;
  const accentColor = hexColor(src.accentColor);
  if (accentColor) next.accentColor = accentColor;
  const backgroundColor = hexColor(src.backgroundColor);
  if (backgroundColor) next.backgroundColor = backgroundColor;
  const headingFont = clean(src.headingFont, MAX_FONT);
  if (headingFont) next.headingFont = headingFont;
  const bodyFont = clean(src.bodyFont, MAX_FONT);
  if (bodyFont) next.bodyFont = bodyFont;
  const voice = clean(src.voice, MAX_VOICE);
  if (voice) next.voice = voice;
  const logoAppearance = clean(src.logoAppearance, MAX_APPEARANCE);
  if (logoAppearance) next.logoAppearance = logoAppearance;
  return next;
}

export function hasUsefulBrandIdentity(identity: BrandIdentity): boolean {
  return Boolean(
    identity.logoImageId ||
      identity.primaryColor ||
      identity.secondaryColor ||
      identity.accentColor ||
      identity.backgroundColor ||
      identity.headingFont ||
      identity.bodyFont ||
      identity.voice,
  );
}

export function buildBrandIdentityPromptBlock(
  identity: BrandIdentity,
  options: {
    useBrandIdentity?: boolean;
    useBrandLogo?: boolean;
    logoAppearance?: string;
  },
): string {
  const lines: string[] = [];
  if (options.useBrandIdentity) {
    const colors = [
      identity.primaryColor && `primária ${identity.primaryColor}`,
      identity.secondaryColor && `secundária ${identity.secondaryColor}`,
      identity.accentColor && `destaque ${identity.accentColor}`,
      identity.backgroundColor && `fundo ${identity.backgroundColor}`,
    ].filter(Boolean);
    if (colors.length) lines.push(`Paleta: ${colors.join('; ')}.`);
    const fonts = [
      identity.headingFont && `títulos ${identity.headingFont}`,
      identity.bodyFont && `corpo ${identity.bodyFont}`,
    ].filter(Boolean);
    if (fonts.length) lines.push(`Tipografia: ${fonts.join('; ')}.`);
    if (identity.voice) lines.push(`Tom de marca: ${identity.voice}.`);
  }
  if (options.useBrandLogo) {
    const appearance =
      clean(options.logoAppearance, MAX_APPEARANCE) ||
      identity.logoAppearance ||
      DEFAULT_LOGO_APPEARANCE;
    lines.push(
      `Inclua o logo da marca anexado como referência: ${appearance}. Não invente outro logo.`,
    );
  }
  if (!lines.length) return '';
  return `Identidade da marca:\n${lines.join('\n')}`;
}

export function assertBrandIdentityInput(raw: unknown): BrandIdentity {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Informe a identidade da marca');
  }
  const src = raw as Record<string, unknown>;
  for (const key of [
    'primaryColor',
    'secondaryColor',
    'accentColor',
    'backgroundColor',
  ] as const) {
    const value = src[key];
    if (value == null || value === '') continue;
    if (!hexColor(value)) {
      throw new Error(`${key} deve ser #RRGGBB`);
    }
  }
  if (src.headingFont != null && clean(src.headingFont, MAX_FONT) === undefined) {
    throw new Error('headingFont inválida');
  }
  if (src.bodyFont != null && clean(src.bodyFont, MAX_FONT) === undefined) {
    throw new Error('bodyFont inválida');
  }
  if (src.voice != null && String(src.voice).trim().length > MAX_VOICE) {
    throw new Error('voice muito longa');
  }
  if (
    src.logoAppearance != null &&
    String(src.logoAppearance).trim().length > MAX_APPEARANCE
  ) {
    throw new Error('logoAppearance muito longa');
  }
  if (src.logoImageId != null && src.logoImageId !== '') {
    const id = clean(src.logoImageId, 64);
    if (!id) throw new Error('logoImageId inválido');
  }
  return parseBrandIdentity(raw);
}

function hexColor(value: unknown): string | undefined {
  const text = clean(value, 7);
  if (!text) return undefined;
  return HEX.test(text) ? text.toUpperCase() : undefined;
}

function clean(value: unknown, max: number): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.slice(0, max);
}
