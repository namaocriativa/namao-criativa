export const CLIP_GENERATING_LOCK_MS = 12 * 60 * 1000;

export function isGeneratingLocked(
  status: string,
  updatedAt: Date | string | null | undefined,
  now = Date.now(),
): boolean {
  if (status !== 'generating') return false;
  const at =
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : Date.parse(String(updatedAt || ''));
  if (!Number.isFinite(at)) return true;
  return now - at < CLIP_GENERATING_LOCK_MS;
}
