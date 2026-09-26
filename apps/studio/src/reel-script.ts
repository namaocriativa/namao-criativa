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

export function formatReelPrompt(beats: ReelBeats, extra = ""): string {
  const lines: string[] = [];
  if (beats.hook?.trim()) lines.push(`Hook: ${beats.hook.trim()}`);
  if (beats.story?.trim()) lines.push(`História: ${beats.story.trim()}`);
  if (beats.cta?.trim()) lines.push(`CTA: ${beats.cta.trim()}`);
  if (beats.overlayText?.trim()) lines.push(`Overlay: ${beats.overlayText.trim()}`);
  if (extra.trim()) lines.push(extra.trim());
  return lines.join("\n");
}

export function parseReelPrompt(prompt?: string): ReelBeats & { extra: string } {
  const beats: ReelBeats & { extra: string } = { extra: "" };
  const leftover: string[] = [];
  for (const raw of String(prompt || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const hook = HOOK_RE.exec(line);
    if (hook) {
      beats.hook = hook[1].trim();
      continue;
    }
    const story = STORY_RE.exec(line);
    if (story) {
      beats.story = story[2].trim();
      continue;
    }
    const cta = CTA_RE.exec(line);
    if (cta) {
      beats.cta = cta[1].trim();
      continue;
    }
    const overlay = OVERLAY_RE.exec(line);
    if (overlay) {
      beats.overlayText = overlay[1].trim();
      continue;
    }
    leftover.push(line);
  }
  beats.extra = leftover.join(" ");
  return beats;
}

export function hasReelBeats(beats: ReelBeats): boolean {
  return Boolean(beats.hook || beats.story || beats.cta);
}
