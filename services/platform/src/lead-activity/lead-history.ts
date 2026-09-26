export type LeadHistoryActor = {
  type: 'system' | 'studio' | 'lead' | 'customer';
  id?: string | null;
  name?: string | null;
};

export type LeadHistoryItem = {
  id: string;
  at: string;
  kind: string;
  channel: string;
  title: string;
  summary: string | null;
  actor: LeadHistoryActor | null;
  payload: Record<string, unknown> | null;
  source: string;
};

export function historyItem(input: {
  id: string;
  at: Date | string;
  kind: string;
  channel: string;
  title: string;
  summary?: string | null;
  actor?: LeadHistoryActor | null;
  payload?: Record<string, unknown> | null;
  source: string;
}): LeadHistoryItem {
  const at = input.at instanceof Date ? input.at.toISOString() : input.at;
  return {
    id: input.id,
    at,
    kind: input.kind,
    channel: input.channel,
    title: input.title,
    summary: input.summary ?? null,
    actor: input.actor ?? { type: 'system' },
    payload: input.payload ?? null,
    source: input.source,
  };
}

export function sortHistory(items: LeadHistoryItem[]): LeadHistoryItem[] {
  return [...items].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function joinLabels(values: Array<string | null | undefined>): string {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' · ');
}
