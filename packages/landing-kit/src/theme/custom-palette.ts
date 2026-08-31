import {
  COLOR_INTENSITY_IDS,
  type ColorIntensity,
} from '../ids';

export type ThemeColors = {
  ink: string;
  paper: string;
  accent: string;
  muted: string;
  surface: string;
};

export type ThemePayload = {
  colors: ThemeColors;
  intensity: ColorIntensity;
};

export const COLOR_ROLES = [
  { key: 'paper', label: 'Fundo' },
  { key: 'surface', label: 'Superfície' },
  { key: 'accent', label: 'Destaque' },
  { key: 'ink', label: 'Texto' },
  { key: 'muted', label: 'Apoio' },
] as const satisfies ReadonlyArray<{ key: keyof ThemeColors; label: string }>;

export const COLOR_INTENSITY_GUIDE: Record<
  ColorIntensity,
  { label: string; artDirector: string; architect: string; colorStrategy: string }
> = {
  leve: {
    label: 'Leve',
    artDirector:
      'Intensidade Leve: paleta travada. Fundos neutros (paper/surface). Accent só em CTA e links. colorStrategy deve descrever uso sutil, sem inventar outras cores.',
    architect:
      'Intensidade Leve: seções em paper/surface. Accent apenas em botões e links. Evite blocos cheios de accent.',
    colorStrategy:
      'Uso sutil da paleta: fundos paper/surface, accent só em CTA e links.',
  },
  moderado: {
    label: 'Moderado',
    artDirector:
      'Intensidade Moderado: paleta travada. Accent no hero, botões e destaques. colorStrategy descreve equilíbrio, sem inventar outras cores.',
    architect:
      'Intensidade Moderado: hero e destaques podem usar accent/surface; demais seções em paper. CTAs no accent.',
    colorStrategy:
      'Uso equilibrado: accent no hero, botões e destaques; demais seções em paper/surface.',
  },
  high: {
    label: 'High',
    artDirector:
      'Intensidade High: paleta travada. Blocos e seções fortemente coloridos com accent/surface/ink. colorStrategy descreve uso saturado, sem inventar outras cores.',
    architect:
      'Intensidade High: várias seções com fundos accent, surface ou ink. Contraste de texto obrigatório. CTAs invertidos quando o fundo for accent.',
    colorStrategy:
      'Uso intenso: blocos e seções coloridos com accent/surface; a paleta aparece em quase toda a página.',
  },
};

const HEX = /^#?([0-9a-fA-F]{6})$/;

export function parseHex(value: string | null | undefined): string | null {
  const match = String(value || '').trim().match(HEX);
  return match ? `#${match[1].toLowerCase()}` : null;
}

export function isThemeColors(value: unknown): value is ThemeColors {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return COLOR_ROLES.every(({ key }) => Boolean(parseHex(String(item[key] || ''))));
}

export function normalizeThemeColors(value: unknown): ThemeColors | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const colors = {} as ThemeColors;
  for (const { key } of COLOR_ROLES) {
    const hex = parseHex(String(item[key] || ''));
    if (!hex) return null;
    colors[key] = hex;
  }
  return colors;
}

export function parseColorIntensity(value: unknown): ColorIntensity {
  const next = String(value || '').trim().toLowerCase();
  return (COLOR_INTENSITY_IDS as readonly string[]).includes(next)
    ? (next as ColorIntensity)
    : 'moderado';
}

function hue2rgb(p: number, q: number, t: number): number {
  let tone = t;
  if (tone < 0) tone += 1;
  if (tone > 1) tone -= 1;
  if (tone < 1 / 6) return p + (q - p) * 6 * tone;
  if (tone < 1 / 2) return q;
  if (tone < 2 / 3) return p + (q - p) * (2 / 3 - tone) * 6;
  return p;
}

export function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;
  const hue = (((h % 360) + 360) % 360) / 360;
  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
  const p = 2 * lig - q;
  const channel = (offset: number) =>
    Math.round(hue2rgb(p, q, hue + offset) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(1 / 3)}${channel(0)}${channel(-1 / 3)}`;
}

export function relativeLuminance(hex: string): number {
  const value = parseHex(hex) || '#000000';
  const channel = (start: number) => {
    const c = parseInt(value.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrastRatio(a: string, b: string): number {
  const hi = Math.max(relativeLuminance(a), relativeLuminance(b));
  const lo = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (hi + 0.05) / (lo + 0.05);
}

export function contrastText(bg: string): '#111111' | '#f5f5f5' {
  return contrastRatio(bg, '#111111') >= contrastRatio(bg, '#f5f5f5')
    ? '#111111'
    : '#f5f5f5';
}

export function generatePalette(
  locked: Partial<ThemeColors> = {},
  random: () => number = Math.random,
): ThemeColors {
  const hue = Math.floor(random() * 360);
  const pick = (key: keyof ThemeColors, s: number, l: number) =>
    locked[key] || hslToHex(hue, s, l);

  const colors: ThemeColors = {
    paper: pick('paper', 12 + random() * 10, 93 + random() * 4),
    surface: pick('surface', 10 + random() * 8, 88 + random() * 6),
    accent: pick('accent', 48 + random() * 22, 40 + random() * 12),
    ink: pick('ink', 22 + random() * 18, 10 + random() * 8),
    muted: pick('muted', 8 + random() * 12, 40 + random() * 10),
  };

  if (!locked.ink && contrastRatio(colors.ink, colors.paper) < 4.5) {
    colors.ink = hslToHex(hue, 30, 9);
  }
  return colors;
}

export function defaultThemePayload(
  random: () => number = Math.random,
): ThemePayload {
  return { colors: generatePalette({}, random), intensity: 'moderado' };
}

export function colorStrategyForTheme(theme: ThemePayload): string {
  const guide = COLOR_INTENSITY_GUIDE[theme.intensity];
  return `${guide.colorStrategy} Paleta: fundo ${theme.colors.paper}, superfície ${theme.colors.surface}, destaque ${theme.colors.accent}, texto ${theme.colors.ink}, apoio ${theme.colors.muted}.`;
}

export function palettePromptBlock(theme: ThemePayload | null | undefined): string {
  if (!theme) return '';
  const guide = COLOR_INTENSITY_GUIDE[theme.intensity];
  const roles = COLOR_ROLES.map(
    (role) => `- ${role.label} (${role.key}): ${theme.colors[role.key]}`,
  ).join('\n');
  return `
Paleta TRAVADA pelo usuário (use exatamente estes hex; NÃO invente outras cores):
${roles}
${guide.artDirector}
`;
}

export function architectPaletteBlock(theme: ThemePayload | null | undefined): string {
  if (!theme) return '';
  const guide = COLOR_INTENSITY_GUIDE[theme.intensity];
  return `
Paleta travada: paper=${theme.colors.paper}, surface=${theme.colors.surface}, accent=${theme.colors.accent}, ink=${theme.colors.ink}, muted=${theme.colors.muted}.
${guide.architect}
`;
}
