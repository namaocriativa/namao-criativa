import { clampWords, CTA_MAX_WORDS, HOOK_MAX_WORDS, STORY_MAX_WORDS } from './copy-limits';

export type ReelBeats = {
  hook?: string;
  story?: string;
  cta?: string;
  overlayText?: string;
};

const HOOK_RE = /^hook:\s*(.*)$/i;
const STORY_RE = /^(hist[oó]ria|story):\s*(.*)$/i;
const CTA_RE = /^cta:\s*(.*)$/i;
const OVERLAY_RE = /^overlay:\s*(.*)$/i;

export function formatReelPrompt(beats: ReelBeats, extra = ''): string {
  const lines: string[] = [];
  if (beats.hook?.trim()) lines.push(`Hook: ${beats.hook.trim()}`);
  if (beats.story?.trim()) lines.push(`História: ${beats.story.trim()}`);
  if (beats.cta?.trim()) lines.push(`CTA: ${beats.cta.trim()}`);
  if (beats.overlayText?.trim()) lines.push(`Overlay: ${beats.overlayText.trim()}`);
  if (extra.trim()) lines.push(extra.trim());
  return lines.join('\n');
}

export function parseReelPrompt(prompt?: string): ReelBeats & { extra: string } {
  const beats: ReelBeats & { extra: string } = { extra: '' };
  const leftover: string[] = [];
  for (const raw of String(prompt || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const hook = HOOK_RE.exec(line);
    if (hook) {
      beats.hook = clampWords(hook[1], HOOK_MAX_WORDS);
      continue;
    }
    const story = STORY_RE.exec(line);
    if (story) {
      beats.story = clampWords(story[2], STORY_MAX_WORDS);
      continue;
    }
    const cta = CTA_RE.exec(line);
    if (cta) {
      beats.cta = clampWords(cta[1], CTA_MAX_WORDS);
      continue;
    }
    const overlay = OVERLAY_RE.exec(line);
    if (overlay) {
      beats.overlayText = clampWords(overlay[1], HOOK_MAX_WORDS);
      continue;
    }
    leftover.push(line);
  }
  beats.extra = leftover.join(' ');
  return beats;
}

export function hasReelBeats(beats: ReelBeats): boolean {
  return Boolean(beats.hook || beats.story || beats.cta);
}

export function overlayRule(overlayText?: string): string {
  const text = overlayText?.trim();
  if (!text) return 'Sem texto na tela.';
  const locked = text.replace(/"/g, "'");
  return `Texto na tela, só este, uma linha no canto inferior, sem logo nem watermark: "${locked}".`;
}

export function extractOverlayLine(value?: string): {
  clean: string;
  overlayText?: string;
} {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let overlayText: string | undefined;
  const kept: string[] = [];
  for (const line of lines) {
    const match = OVERLAY_RE.exec(line);
    if (match) {
      overlayText = clampWords(match[1], HOOK_MAX_WORDS);
      continue;
    }
    kept.push(line);
  }
  return { clean: kept.join(' '), overlayText };
}
