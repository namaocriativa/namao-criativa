export const HEADLINE_MAX_WORDS = 10;
export const BODY_MAX_WORDS = 12;
export const HOOK_MAX_WORDS = 10;
export const STORY_MAX_WORDS = 20;
export const CTA_MAX_WORDS = 10;

const SAVE_OR_COMMENT =
  /\b(salv[aeo]|salva[mr]|comenta|coment[ae]|comente)\b/i;

export function wordList(value: unknown): string[] {
  if (value == null) return [];
  return String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function wordCount(value: unknown): number {
  return wordList(value).length;
}

export function clampWords(value: unknown, maxWords: number, fallback = ''): string {
  const words = wordList(value);
  if (!words.length) return fallback;
  if (!Number.isFinite(maxWords) || maxWords < 1) return words.join(' ');
  return words.slice(0, Math.floor(maxWords)).join(' ');
}

export function hasSaveOrCommentCta(value: unknown): boolean {
  return SAVE_OR_COMMENT.test(String(value || ''));
}

export function withSaveOrCommentCta(
  value: unknown,
  fallback = 'Salve este carrossel',
): string {
  const text = String(value || '').trim();
  if (hasSaveOrCommentCta(text)) return text;
  if (!text) return fallback;
  return `${text}\n\n${fallback}`;
}
