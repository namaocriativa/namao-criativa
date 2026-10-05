export type TextFontId =
  | "classic"
  | "modern"
  | "neon"
  | "typewriter"
  | "strong"
  | "serif";

export type TextAlign = "left" | "center" | "right";
export type TextBackground = "none" | "solid" | "highlight";

export type ClipTextStyle = {
  body: string;
  fontId: TextFontId;
  color: string;
  align: TextAlign;
  background: TextBackground;
};

export type TextFontPreset = {
  id: TextFontId;
  label: string;
  family: string;
  weight: number;
  letterSpacing: number;
  glow: boolean;
};

export const TEXT_FONTS: TextFontPreset[] = [
  {
    id: "classic",
    label: "Clássica",
    family: "Inter, sans-serif",
    weight: 700,
    letterSpacing: 0,
    glow: false,
  },
  {
    id: "modern",
    label: "Moderna",
    family: "Montserrat, sans-serif",
    weight: 700,
    letterSpacing: -0.03,
    glow: false,
  },
  {
    id: "neon",
    label: "Neon",
    family: "Inter, sans-serif",
    weight: 700,
    letterSpacing: 0.04,
    glow: true,
  },
  {
    id: "typewriter",
    label: "Máquina de escrever",
    family: '"Special Elite", monospace',
    weight: 400,
    letterSpacing: 0,
    glow: false,
  },
  {
    id: "strong",
    label: "Forte",
    family: "Anton, sans-serif",
    weight: 400,
    letterSpacing: 0.02,
    glow: false,
  },
  {
    id: "serif",
    label: "Serifada",
    family: '"Playfair Display", serif',
    weight: 700,
    letterSpacing: 0,
    glow: false,
  },
];

export const TEXT_FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@700&family=Montserrat:wght@700&family=Playfair+Display:wght@700&family=Special+Elite&display=swap";

export function textFontById(id: TextFontId): TextFontPreset {
  return TEXT_FONTS.find((font) => font.id === id) || TEXT_FONTS[0];
}

export function defaultClipText(body = "Texto"): ClipTextStyle {
  return {
    body,
    fontId: "classic",
    color: "#ffffff",
    align: "center",
    background: "none",
  };
}

export function ensureTextFonts(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById("ve-text-fonts")) return;
  const link = document.createElement("link");
  link.id = "ve-text-fonts";
  link.rel = "stylesheet";
  link.href = TEXT_FONT_STYLESHEET;
  document.head.appendChild(link);
}

export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  body: string,
  maxWidth: number,
): string[] {
  const paragraphs = (body || " ").split(/\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push(" ");
      continue;
    }
    let current = words[0];
    for (const word of words.slice(1)) {
      const next = `${current} ${word}`;
      if (ctx.measureText(next).width <= maxWidth) current = next;
      else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [" "];
}

function contrastInk(color: string): string {
  const hex = color.replace("#", "");
  if (hex.length < 6) return "#111111";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.62 ? "#111111" : "#ffffff";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: ClipTextStyle,
  transform?: { x: number; y: number; scale: number },
) {
  const preset = textFontById(text.fontId);
  const scale = transform?.scale ?? 1;
  const fontSize = Math.max(18, Math.round(width * 0.072 * scale));
  const maxWidth = width * 0.82;
  ctx.save();
  ctx.font = `${preset.weight} ${fontSize}px ${preset.family}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = text.align;
  if (preset.letterSpacing) {
    (
      ctx as CanvasRenderingContext2D & { letterSpacing?: string }
    ).letterSpacing = `${preset.letterSpacing}em`;
  }
  const lines = wrapTextLines(ctx, text.body, maxWidth);
  const lineHeight = fontSize * 1.28;
  const blockH = lines.length * lineHeight;
  const cx = width / 2 + (transform?.x ?? 0);
  const cy = height / 2 + (transform?.y ?? 0);
  const anchorX =
    text.align === "left"
      ? cx - maxWidth / 2
      : text.align === "right"
        ? cx + maxWidth / 2
        : cx;

  if (text.background === "solid") {
    const padX = fontSize * 0.45;
    const padY = fontSize * 0.28;
    let widest = 0;
    for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
    const boxW = Math.min(maxWidth, widest) + padX * 2;
    const boxH = blockH + padY * 2;
    const boxX = cx - boxW / 2;
    const boxY = cy - boxH / 2;
    ctx.fillStyle = text.color;
    roundRect(ctx, boxX, boxY, boxW, boxH, fontSize * 0.2);
    ctx.fill();
  }

  lines.forEach((line, index) => {
    const y = cy - blockH / 2 + lineHeight / 2 + index * lineHeight;
    if (text.background === "highlight") {
      const measured = ctx.measureText(line).width;
      const padX = fontSize * 0.28;
      const boxW = measured + padX * 2;
      const boxH = lineHeight * 0.92;
      const boxX =
        text.align === "center"
          ? anchorX - boxW / 2
          : text.align === "right"
            ? anchorX - boxW
            : anchorX - padX;
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = text.color;
      roundRect(ctx, boxX, y - boxH / 2, boxW, boxH, fontSize * 0.16);
      ctx.fill();
      ctx.fillStyle = contrastInk(text.color);
      ctx.fillText(line, anchorX, y);
      ctx.restore();
      return;
    }
    if (preset.glow) {
      ctx.shadowColor = text.color;
      ctx.shadowBlur = fontSize * 0.45;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle =
      text.background === "solid" ? contrastInk(text.color) : text.color;
    ctx.fillText(line, anchorX, y);
  });
  ctx.restore();
}

export async function rasterizeTextOverlay(
  text: ClipTextStyle,
  transform: { x: number; y: number; scale: number } | undefined,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível para o texto");
  drawTextOverlay(ctx, width, height, text, transform);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/png");
  });
  if (!blob) throw new Error("Falha ao gerar PNG do texto");
  return new Uint8Array(await blob.arrayBuffer());
}
