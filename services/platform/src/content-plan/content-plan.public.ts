import type { ContentPlanItem } from './content-plan.planner';

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
  status: string;
  sourceIgJobId: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    postsPerWeek: row.postsPerWeek,
    weeks: row.weeks,
    formats: Array.isArray(row.formats) ? row.formats : [],
    items: Array.isArray(row.items) ? (row.items as ContentPlanItem[]) : [],
    status: row.status,
    sourceIgJobId: row.sourceIgJobId,
    createdAt: row.createdAt,
  };
}

export type PublicContentPlan = ReturnType<typeof publicContentPlan>;
