import type { ComponentType } from 'react';
import type { ComponentId, FamilyId } from '../ids';
import type { ZodType } from 'zod';

export type ComponentCapability =
  | 'animation'
  | 'scroll'
  | 'mouse'
  | 'video'
  | 'image'
  | 'parallax'
  | 'webgl'
  | 'magnetic'
  | 'words'
  | 'screenshot'
  | 'layout';

export type ComponentRuntime = 'lite' | 'premium';

export type SectionComponent = ComponentType<{ id: string; props: never }>;

export type CapabilityMeta = {
  capabilities: ComponentCapability[];
  runtime: ComponentRuntime;
  performance?: string;
  mobile?: string;
};

export type LlmCatalogItem = {
  id: ComponentId;
  aliases: string[];
  category: FamilyId;
  runtime: ComponentRuntime;
  capabilities: ComponentCapability[];
  description: string;
  good_for: string[];
  avoid_for: string[];
  visual_weight: string;
  supports: Record<string, boolean>;
  performance?: string;
  mobile?: string;
};

export type RegistryEntry = {
  id: ComponentId;
  aliases: string[];
  category: FamilyId;
  capabilities: ComponentCapability[];
  runtime: ComponentRuntime;
  description: string;
  goodFor: string[];
  avoidFor: string[];
  propsSchema: ZodType;
  load?: () => Promise<{ default: SectionComponent }>;
  component?: SectionComponent;
  performance?: string;
  mobile?: string;
  example?: Record<string, unknown>;
};
