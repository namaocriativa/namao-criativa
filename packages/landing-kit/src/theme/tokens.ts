import type { FontPairId, PaletteId, RadiusId, SpacingId, StyleId } from '../ids';

export type Palette = {
  id: PaletteId;
  label: string;
  colors: {
    ink: string;
    paper: string;
    accent: string;
    muted: string;
    surface: string;
  };
};

export const PALETTES: Palette[] = [
  {
    id: 'slate-teal',
    label: 'Ardósia e teal',
    colors: {
      ink: '#142033',
      paper: '#eef2f4',
      accent: '#1f6b5c',
      muted: '#5b6b7c',
      surface: '#ffffff',
    },
  },
  {
    id: 'ink-gold',
    label: 'Tinta e ouro',
    colors: {
      ink: '#1a1612',
      paper: '#f3efe8',
      accent: '#9a6b2f',
      muted: '#6e6458',
      surface: '#fffaf3',
    },
  },
  {
    id: 'navy-coral',
    label: 'Marinho e coral',
    colors: {
      ink: '#0f1c2e',
      paper: '#f2f5f8',
      accent: '#c45c4a',
      muted: '#5a6a7a',
      surface: '#ffffff',
    },
  },
  {
    id: 'forest',
    label: 'Floresta',
    colors: {
      ink: '#13261c',
      paper: '#eef3ef',
      accent: '#2f6b45',
      muted: '#5a6e60',
      surface: '#f7faf7',
    },
  },
];

export function getPalette(id: string | undefined): Palette {
  return PALETTES.find((item) => item.id === id) || PALETTES[0];
}

export type FontPair = {
  id: FontPairId;
  label: string;
  display: string;
  body: string;
  googleFontsHref: string;
};

export const FONT_PAIRS: FontPair[] = [
  {
    id: 'fraunces-source',
    label: 'Fraunces + Source Sans 3',
    display: '"Fraunces", Georgia, serif',
    body: '"Source Sans 3", system-ui, sans-serif',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600&display=swap',
  },
  {
    id: 'literata-ibm',
    label: 'Literata + IBM Plex Sans',
    display: '"Literata", Georgia, serif',
    body: '"IBM Plex Sans", system-ui, sans-serif',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Literata:opsz,wght@7..72,500;7..72,700&display=swap',
  },
  {
    id: 'playfair-lato',
    label: 'Playfair + Lato',
    display: '"Playfair Display", Georgia, serif',
    body: '"Lato", system-ui, sans-serif',
    googleFontsHref:
      'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Playfair+Display:wght@500;700&display=swap',
  },
];

export function getFontPair(id: string | undefined): FontPair {
  return FONT_PAIRS.find((item) => item.id === id) || FONT_PAIRS[0];
}

export type StyleRecipe = {
  style: StyleId;
  paletteId: PaletteId;
  fontPairId: FontPairId;
  radius: RadiusId;
  spacing: SpacingId;
};

export const STYLE_RECIPES: Record<StyleId, StyleRecipe> = {
  premium: {
    style: 'premium',
    paletteId: 'slate-teal',
    fontPairId: 'fraunces-source',
    radius: 'large',
    spacing: 'generous',
  },
  minimal: {
    style: 'minimal',
    paletteId: 'slate-teal',
    fontPairId: 'literata-ibm',
    radius: 'small',
    spacing: 'generous',
  },
  luxury: {
    style: 'luxury',
    paletteId: 'ink-gold',
    fontPairId: 'playfair-lato',
    radius: 'small',
    spacing: 'generous',
  },
  modern: {
    style: 'modern',
    paletteId: 'navy-coral',
    fontPairId: 'fraunces-source',
    radius: 'large',
    spacing: 'compact',
  },
  corporate: {
    style: 'corporate',
    paletteId: 'slate-teal',
    fontPairId: 'literata-ibm',
    radius: 'small',
    spacing: 'compact',
  },
  playful: {
    style: 'playful',
    paletteId: 'navy-coral',
    fontPairId: 'fraunces-source',
    radius: 'large',
    spacing: 'generous',
  },
  editorial: {
    style: 'editorial',
    paletteId: 'ink-gold',
    fontPairId: 'playfair-lato',
    radius: 'small',
    spacing: 'generous',
  },
  industrial: {
    style: 'industrial',
    paletteId: 'forest',
    fontPairId: 'literata-ibm',
    radius: 'small',
    spacing: 'compact',
  },
};

export function recipeForStyle(style: StyleId): StyleRecipe {
  return STYLE_RECIPES[style];
}

export function heuristicStyle(category: string | null | undefined): StyleId {
  const text = `${category || ''}`.toLowerCase();
  if (/advog|direito|jur[ií]d/.test(text)) return 'luxury';
  if (/restaura|comida|food|caf[eé]|bar|pizz/.test(text)) return 'editorial';
  if (/sa[uú]de|cl[ií]nic|dent|m[eé]dic/.test(text)) return 'minimal';
  if (/im[oó]v|real.?estate|constr/.test(text)) return 'premium';
  if (/industr|oficin|mec[aâ]n/.test(text)) return 'industrial';
  if (/escola|kid|infantil|festa/.test(text)) return 'playful';
  if (/consult|b2b|ag[eê]ncia/.test(text)) return 'corporate';
  return 'modern';
}
