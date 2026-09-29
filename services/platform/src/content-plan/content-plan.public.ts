import {
  parsePlanItems,
  type ContentPlanClientContext,
  type ContentPlanFormBrief,
  type ContentPlanStrategy,
} from './content-plan.contract';

export const CONTENT_PLAN_STATUS = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
} as const;

export type ContentPlanReason =
  | 'instagram_disconnected'
  | 'ig_skill_required';

export function publicContentPlan(row: {
  id: string;
  title: string;
  description: string;
  postsPerWeek: number;
  weeks: number;
  formats: unknown;
  items: unknown;
  strategy?: unknown;
  brief?: unknown;
  status: string;
  sourceIgJobId: string;
  referencePlanId?: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    postsPerWeek: row.postsPerWeek,
    weeks: row.weeks,
    formats: Array.isArray(row.formats) ? row.formats : [],
    items: parsePlanItems(row.items),
    strategy: (row.strategy && typeof row.strategy === 'object'
      ? row.strategy
      : null) as ContentPlanStrategy | null,
    brief: (row.brief && typeof row.brief === 'object'
      ? row.brief
      : null) as ContentPlanFormBrief | null,
    status: row.status,
    sourceIgJobId: row.sourceIgJobId,
    referencePlanId: row.referencePlanId || null,
    createdAt: row.createdAt,
  };
}

export type PublicContentPlan = ReturnType<typeof publicContentPlan>;
export type { ContentPlanClientContext };
