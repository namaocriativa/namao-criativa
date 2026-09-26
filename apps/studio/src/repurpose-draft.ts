export const REPURPOSE_DRAFT_KEY = "namao-repurpose-draft";

export type RepurposeDraft = {
  prompt: string;
  notes?: string;
  leadId?: string;
  hook?: string;
  story?: string;
  cta?: string;
  overlayText?: string;
};

export function saveRepurposeDraft(draft: RepurposeDraft): void {
  sessionStorage.setItem(REPURPOSE_DRAFT_KEY, JSON.stringify(draft));
}

export function takeRepurposeDraft(): RepurposeDraft | null {
  const raw = sessionStorage.getItem(REPURPOSE_DRAFT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(REPURPOSE_DRAFT_KEY);
  try {
    const parsed = JSON.parse(raw) as RepurposeDraft;
    if (!parsed?.prompt?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}
