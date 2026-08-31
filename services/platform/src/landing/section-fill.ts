import { isDeterministicType } from './catalog-map';
import type {
  GeneratedSection,
  LandingSectionConfig,
  LeadBrief,
  SectionContentPayload,
  SitePlan,
} from './pipeline.types';

export function fillDeterministicSection(
  brief: LeadBrief,
  plan: SitePlan,
  sectionConfig: LandingSectionConfig,
): GeneratedSection | null {
  if (!isDeterministicType(sectionConfig.type)) return null;

  const content = contentFor(sectionConfig.type, brief, plan);
  return {
    id: sectionConfig.id,
    type: sectionConfig.type,
    content,
  };
}

function contentFor(
  type: string,
  brief: LeadBrief,
  plan: SitePlan,
): SectionContentPayload {
  switch (type) {
    case 'services':
      return {
        title: 'Serviços',
        items: brief.services ? [...brief.services] : [],
      };
    case 'gallery':
      return {
        title: 'Galeria',
        imageRefs: brief.images
          .filter((img) => img.kind === 'photo')
          .map((img) => img.publicPath),
      };
    case 'footer':
      return { title: brief.name };
    case 'testimonials': {
      const content: SectionContentPayload = { title: 'Avaliações' };
      if (brief.rating != null) {
        content.subtitle =
          brief.reviewCount != null
            ? `Nota ${brief.rating} · ${brief.reviewCount} avaliações`
            : `Nota ${brief.rating}`;
      }
      return content;
    }
    case 'header': {
      const content: SectionContentPayload = { title: brief.name };
      content.nav = plan.sectionConfigs
        .filter((item) => item.type !== 'header' && item.type !== 'footer')
        .map((item) => ({ label: item.title, href: `#${item.id}` }));
      if (plan.primaryCta) {
        content.ctaLabel = plan.primaryCta.label;
        content.ctaHref = plan.primaryCta.href;
      }
      return content;
    }
    default:
      return { title: brief.name };
  }
}
