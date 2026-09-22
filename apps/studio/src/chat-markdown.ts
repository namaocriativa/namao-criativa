function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;

export function formatChatMarkdown(raw: string): string {
  const text = String(raw || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!text) return "";
  return splitBlocks(splitRunOnBullets(text))
    .map(renderBlock)
    .join("");
}

function splitRunOnBullets(text: string): string {
  return text
    .replace(/([.:!?])\s+\*\s+/g, "$1\n* ")
    .replace(/\s+\*\s+(?=\*\*)/g, "\n* ");
}

function splitBlocks(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function renderBlock(block: string): string {
  const lines = block.split("\n").map((line) => line.trimEnd());
  const lead: string[] = [];
  const items: string[] = [];
  const trail: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (BULLET_RE.test(trimmed)) {
      items.push(trimmed.replace(BULLET_RE, ""));
      continue;
    }
    if (items.length) trail.push(trimmed);
    else lead.push(trimmed);
  }

  if (!items.length) return paragraph(lines.map((line) => line.trim()).filter(Boolean));

  return `${lead.length ? paragraph(lead) : ""}<ul>${items
    .map((item) => `<li>${formatInline(item)}</li>`)
    .join("")}</ul>${trail.length ? paragraph(trail) : ""}`;
}

function paragraph(lines: string[]): string {
  return `<p>${lines.map((line) => formatInline(line)).join("<br>")}</p>`;
}

function formatInline(text: string): string {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
}
