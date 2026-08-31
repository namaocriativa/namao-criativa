import { isDeterministicType } from './catalog-map';
import { CUSTOM_SECTION_TYPE } from './section-catalog';
import type { LandingSectionConfig, LeadBrief, VisionAnalysis } from './pipeline.types';

export type PipelineComplexity = 'simple' | 'medium' | 'rich';

export type PipelineIntent = {
  skipVision: boolean;
  useHeuristicDesign: boolean;
  skipReview: boolean;
  complexity: PipelineComplexity;
};

export function shouldSkipVision(imageCount: number): boolean {
  return imageCount <= 0;
}

export function analyzePipelineIntent(opts: {
  brief: LeadBrief;
  sections: LandingSectionConfig[];
  vision: VisionAnalysis | null;
  imageCount: number;
}): PipelineIntent {
  const { brief, sections, vision, imageCount } = opts;
  const hasCustom = sections.some((section) => section.type === CUSTOM_SECTION_TYPE);
  const onlyDeterministicPlusHero = sections.every(
    (section) =>
      isDeterministicType(section.type) || section.type === 'hero',
  );
  const llmCount = sections.filter(
    (section) => !isDeterministicType(section.type),
  ).length;

  const skipVision = shouldSkipVision(imageCount);
  const useHeuristicDesign = !vision && !brief.category && !brief.description;
  const skipReview =
    !brief.description && !hasCustom && onlyDeterministicPlusHero;

  let complexity: PipelineComplexity = 'medium';
  if (hasCustom || vision || (brief.description && llmCount >= 4)) {
    complexity = 'rich';
  } else if (skipReview || llmCount <= 1) {
    complexity = 'simple';
  }

  return {
    skipVision,
    useHeuristicDesign,
    skipReview,
    complexity,
  };
}

export function heuristicDesignIds(brief: LeadBrief): {
  paletteId: string;
  fontPairId: string;
} {
  const category = `${brief.category || ''} ${brief.name || ''}`.toLowerCase();
  if (/advog|direito|jur[ií]d/.test(category)) {
    return { paletteId: 'ink-gold', fontPairId: 'playfair-lato' };
  }
  if (/restaura|comida|food|caf[eé]|bar|pizz/.test(category)) {
    return { paletteId: 'navy-coral', fontPairId: 'fraunces-source' };
  }
  if (/sa[uú]de|cl[ií]nic|dent|m[eé]dic/.test(category)) {
    return { paletteId: 'forest', fontPairId: 'literata-ibm' };
  }
  return { paletteId: 'slate-teal', fontPairId: 'fraunces-source' };
}
