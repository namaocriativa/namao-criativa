export type SiteSkillStage =
  | 'queued'
  | 'scaffold'
  | 'prompt'
  | 'code'
  | 'media'
  | 'github'
  | 'link'
  | 'clone'
  | 'done'
  | 'error';

export type SiteSkillLogItem = {
  stage: SiteSkillStage;
  message: string;
  at: string;
};

export function publicJob(row: {
  id: string;
  status: string;
  stage: string;
  log: unknown;
  error: string | null;
  model: string;
  notes: string;
  repo: string;
  slug: string;
}) {
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    log: Array.isArray(row.log) ? row.log : [],
    error: row.error,
    model: row.model,
    notes: row.notes,
    repo: row.repo,
    slug: row.slug,
  };
}
