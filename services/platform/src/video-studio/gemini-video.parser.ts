export type GeminiVideoPart =
  | { type: 'text'; text: string }
  | { type: 'thought'; text: string }
  | { type: 'video'; mimeType: string; data: string };

type GeminiContentItem = {
  type?: string;
  text?: string;
  mime_type?: string;
  mimeType?: string;
  data?: string;
};

type GeminiStep = {
  type?: string;
  content?: GeminiContentItem[] | GeminiContentItem;
};

export function extractGeminiVideoParts(data: unknown): GeminiVideoPart[] {
  const root = data as {
    steps?: GeminiStep[];
    output_video?: GeminiContentItem;
    outputVideo?: GeminiContentItem;
  };
  const out: GeminiVideoPart[] = [];

  for (const step of root.steps || []) {
    const stepType = (step.type || '').toLowerCase();
    if (stepType === 'user_input') continue;
    const items = Array.isArray(step.content)
      ? step.content
      : step.content
        ? [step.content]
        : [];
    for (const item of items) {
      const itemType = (item.type || '').toLowerCase();
      if (item.data && (itemType === 'video' || stepType === 'model_output')) {
        if (itemType === 'video' || looksLikeVideo(item)) {
          out.push({
            type: 'video',
            mimeType: item.mimeType || item.mime_type || 'video/mp4',
            data: item.data,
          });
          continue;
        }
      }
      if (!item.text) continue;
      if (itemType === 'thought' || stepType === 'thought') {
        out.push({ type: 'thought', text: item.text });
        continue;
      }
      if (itemType === 'text' || stepType === 'model_output') {
        out.push({ type: 'text', text: item.text });
      }
    }
  }

  const convenience = root.output_video || root.outputVideo;
  if (convenience?.data && !out.some((part) => part.type === 'video')) {
    out.push({
      type: 'video',
      mimeType: convenience.mimeType || convenience.mime_type || 'video/mp4',
      data: convenience.data,
    });
  }

  return out;
}

export function geminiVideoBlockReason(data: unknown): string | undefined {
  const root = data as {
    status?: string;
    error?: { message?: string };
    promptFeedback?: { blockReason?: string };
  };
  if (root.promptFeedback?.blockReason) return root.promptFeedback.blockReason;
  if (root.error?.message) return root.error.message;
  if (root.status && root.status !== 'completed') {
    return `status ${root.status}`;
  }
  return undefined;
}

export function geminiInteractionId(data: unknown): string | undefined {
  const id = (data as { id?: unknown })?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

export function summarizeGeminiVideoParts(parts: GeminiVideoPart[]): {
  text: string;
  thoughts: string;
  videos: Array<{ mimeType: string; buffer: Buffer }>;
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
  const videos = parts
    .filter((part) => part.type === 'video')
    .map((part) => ({
      mimeType: part.mimeType,
      buffer: Buffer.from(part.data, 'base64'),
    }));
  return { text, thoughts, videos };
}

function looksLikeVideo(item: GeminiContentItem): boolean {
  const mime = (item.mimeType || item.mime_type || '').toLowerCase();
  return mime.startsWith('video/');
}
