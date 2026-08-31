import type { DensityId, RadiusId, SpacingId } from '../ids';
import type { ThemeSpec } from '../spec/page-spec';
import { isThemeColors, type ThemeColors } from './custom-palette';
import { getFontPair, getPalette, recipeForStyle } from './tokens';

export type ResolvedTheme = ThemeSpec & {
  colors: ThemeColors;
  fonts: { display: string; body: string };
  googleFontsHref: string;
  cssVariables: string;
};

export function resolveTheme(
  partial: Partial<ThemeSpec> & Pick<ThemeSpec, 'style'>,
): ResolvedTheme {
  const recipe = recipeForStyle(partial.style);
  const palette = getPalette(partial.paletteId || recipe.paletteId);
  const fonts = getFontPair(partial.fontPairId || recipe.fontPairId);
  const density: DensityId = partial.density || 'medium';
  const radius: RadiusId = partial.radius || recipe.radius;
  const spacing: SpacingId = partial.spacing || recipe.spacing;
  const colors = isThemeColors(partial.colors) ? partial.colors : palette.colors;

  const theme: ThemeSpec = {
    style: partial.style,
    visualLanguage: partial.visualLanguage || '',
    colorStrategy: partial.colorStrategy || '',
    imageStrategy: partial.imageStrategy || 'balanced',
    density,
    radius,
    spacing,
    paletteId: palette.id,
    fontPairId: fonts.id,
    animation: partial.animation || 'cinematic',
    ...(isThemeColors(partial.colors) ? { colors: partial.colors } : {}),
  };

  const cssVariables = buildCssVariables(theme, colors, fonts);
  return {
    ...theme,
    colors,
    fonts: { display: fonts.display, body: fonts.body },
    googleFontsHref: fonts.googleFontsHref,
    cssVariables,
  };
}

export function buildCssVariables(
  theme: Pick<ThemeSpec, 'density' | 'radius' | 'spacing'>,
  colors: ResolvedTheme['colors'],
  fonts: { display: string; body: string },
): string {
  const radiusPx = theme.radius === 'large' ? '0.85rem' : '0.28rem';
  const sectionSpace =
    theme.spacing === 'compact'
      ? '3rem 0'
      : theme.density === 'low'
        ? '5.5rem 0'
        : '4.5rem 0';
  return `:root {
  --ink: ${colors.ink};
  --paper: ${colors.paper};
  --accent: ${colors.accent};
  --muted: ${colors.muted};
  --surface: ${colors.surface};
  --font-display: ${fonts.display};
  --font-body: ${fonts.body};
  --container: 1080px;
  --section-space: ${sectionSpace};
  --radius: ${radiusPx};
  --density: ${theme.density};
}`;
}
