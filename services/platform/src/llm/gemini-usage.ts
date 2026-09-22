export type GeminiUsage = {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
};

export function extractGeminiUsage(data: unknown): GeminiUsage | null {
  const root = data as {
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
      prompt_tokens?: number;
      completion_tokens?: number;
    };
  };
  const meta = root.usageMetadata;
  if (
    meta &&
    (meta.promptTokenCount || meta.candidatesTokenCount || meta.totalTokenCount)
  ) {
    const promptTokens = Number(meta.promptTokenCount) || 0;
    const candidatesTokens = Number(meta.candidatesTokenCount) || 0;
    return {
      promptTokens,
      candidatesTokens,
      totalTokens:
        Number(meta.totalTokenCount) || promptTokens + candidatesTokens,
    };
  }
  const usage = root.usage;
  if (usage) {
    const promptTokens =
      Number(usage.prompt_tokens) || Number(usage.input_tokens) || 0;
    const candidatesTokens =
      Number(usage.completion_tokens) || Number(usage.output_tokens) || 0;
    const totalTokens =
      Number(usage.total_tokens) || promptTokens + candidatesTokens;
    if (promptTokens || candidatesTokens || totalTokens) {
      return { promptTokens, candidatesTokens, totalTokens };
    }
  }
  return null;
}

export function mergeGeminiUsage(
  left: GeminiUsage | null | undefined,
  right: GeminiUsage | null | undefined,
): GeminiUsage | null {
  if (!left) return right || null;
  if (!right) return left;
  return {
    promptTokens: left.promptTokens + right.promptTokens,
    candidatesTokens: left.candidatesTokens + right.candidatesTokens,
    totalTokens: left.totalTokens + right.totalTokens,
  };
}

export function estimatePromptTokens(
  prompt: string,
  extraItems = 0,
): number {
  const fromText = Math.ceil(Math.max(prompt.trim().length, 1) / 4);
  return fromText + extraItems * 258;
}
