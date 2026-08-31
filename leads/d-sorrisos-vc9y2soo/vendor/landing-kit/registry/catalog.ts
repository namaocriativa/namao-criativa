import { COMPONENT_CATALOG } from '../catalog/variants';
import type { ComponentId, FamilyId } from '../ids';
import { aliasesFor, capabilitiesFor, runtimeFor } from './component-capabilities';
import type {
  ComponentCapability,
  ComponentRuntime,
  LlmCatalogItem,
} from './component-types';

export type LlmCatalogOpts = {
  runtime?: ComponentRuntime | 'all';
  families?: FamilyId[];
};

function includeRuntime(id: ComponentId, runtime?: ComponentRuntime | 'all') {
  if (!runtime || runtime === 'all' || runtime === 'premium') return true;
  if (runtimeFor(id) === 'lite') return true;
  return id === 'hero.morphing';
}

export function toLlmCatalog(opts: LlmCatalogOpts = {}): LlmCatalogItem[] {
  const { runtime = 'all', families } = opts;
  return COMPONENT_CATALOG.filter((item) => {
    if (families?.length && !families.includes(item.family)) return false;
    return includeRuntime(item.id, runtime);
  }).map((item) => {
    const caps = capabilitiesFor(item.id);
    return {
      id: item.id,
      aliases: aliasesFor(item.id),
      category: item.family,
      runtime: caps.runtime,
      capabilities: caps.capabilities,
      description: item.description,
      good_for: item.goodFor,
      avoid_for: item.avoidFor,
      visual_weight: item.visualWeight,
      supports: item.supports,
      performance: caps.performance,
      mobile: caps.mobile,
    };
  });
}

export function listByCategory(category: FamilyId, opts?: LlmCatalogOpts) {
  return toLlmCatalog({ ...opts, families: [category] });
}

export function listByCapability(
  capability: ComponentCapability,
  opts?: LlmCatalogOpts,
) {
  return toLlmCatalog(opts).filter((item) =>
    item.capabilities.includes(capability),
  );
}

export function getCatalogEntry(id: string) {
  return toLlmCatalog().find((item) => item.id === id);
}
