export type GeminiImagePart =
  | { type: 'text'; text: string }
  | { type: 'thought'; text: string }
  | { type: 'image'; mimeType: string; data: string };

type GeminiInline = {
  mimeType?: string;
  mime_type?: string;
  data?: string;
};

type GeminiRawPart = {
  text?: string;
  thought?: boolean;
  inlineData?: GeminiInline;
  inline_data?: GeminiInline;
};

export function extractGeminiImageParts(data: unknown): GeminiImagePart[] {
  const candidates = (
    data as {
      candidates?: Array<{ content?: { parts?: GeminiRawPart[] } }>;
    }
  )?.candidates;
  const parts = candidates?.[0]?.content?.parts || [];
  const out: GeminiImagePart[] = [];

  for (const part of parts) {
    if (part.thought) {
      if (part.text) out.push({ type: 'thought', text: part.text });
      continue;
    }
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      out.push({
        type: 'image',
        mimeType: inline.mimeType || inline.mime_type || 'image/png',
        data: inline.data,
      });
      continue;
    }
    if (!part.text) continue;
    out.push({ type: 'text', text: part.text });
  }

  return out;
}

export function geminiPromptBlockReason(data: unknown): string | undefined {
  const block = (data as { promptFeedback?: { blockReason?: string } })
    ?.promptFeedback?.blockReason;
  return block || undefined;
}

export function summarizeGeminiImageParts(parts: GeminiImagePart[]): {
  text: string;
  thoughts: string;
  images: Array<{ mimeType: string; buffer: Buffer }>;
} {
  const text = parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
  const thoughts = parts
    .filter((part) => part.type === 'thought')
    .map((part) => part.text)
    .join('\n')
    .trim();
  const images = parts
    .filter((part) => part.type === 'image')
    .map((part) => ({
      mimeType: part.mimeType,
      buffer: Buffer.from(part.data, 'base64'),
    }));
  return { text, thoughts, images };
}

export function keepFinalGeminiImage<T>(images: T[]): T[] {
  if (images.length <= 1) return images;
  return images.slice(-1);
}
