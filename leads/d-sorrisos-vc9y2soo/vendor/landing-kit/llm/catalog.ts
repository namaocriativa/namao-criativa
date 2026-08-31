import { GRAMMAR_TEXT } from '../catalog/grammar';
import { STYLE_IDS, type FamilyId } from '../ids';
import { FONT_PAIRS, PALETTES } from '../theme/tokens';
import { toLlmCatalog } from '../registry/catalog';
import type { ComponentRuntime } from '../registry/component-types';

export function compactCatalogForPrompt(
  families?: FamilyId[],
  opts?: { runtime?: ComponentRuntime | 'all' },
) {
  return toLlmCatalog({
    families,
    runtime: opts?.runtime ?? 'all',
  });
}

export function designContextBlock() {
  return {
    styles: STYLE_IDS,
    palettes: PALETTES.map((item) => item.id),
    fonts: FONT_PAIRS.map((item) => item.id),
    grammar: GRAMMAR_TEXT,
    components: compactCatalogForPrompt(),
  };
}
