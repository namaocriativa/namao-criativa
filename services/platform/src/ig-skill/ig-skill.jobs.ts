export type IgSkillStage =
  | 'queued'
  | 'media'
  | 'compact'
  | 'plan'
  | 'done'
  | 'error';

export type IgSkillLogItem = {
  stage: IgSkillStage;
  message: string;
  at: string;
};

export function publicIgJob(row: {
  id: string;
  status: string;
  stage: string;
  log: unknown;
  error: string | null;
  model: string;
  notes: string;
  days: number;
  report: unknown;
}) {
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    log: Array.isArray(row.log) ? row.log : [],
    error: row.error,
    model: row.model,
    notes: row.notes,
    days: row.days,
    report: row.report ?? null,
  };
}
