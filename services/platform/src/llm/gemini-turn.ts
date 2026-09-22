import { extractGeminiUsage, type GeminiUsage } from './gemini-usage';

export type GeminiToolDeclaration = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type GeminiFunctionCall = {
  name: string;
  args: Record<string, unknown>;
};

export type GeminiTurnPart =
  | { text: string }
  | { functionCall: GeminiFunctionCall }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export type GeminiTurnContent = {
  role: 'user' | 'model';
  parts: GeminiTurnPart[];
};

export type GeminiTurnResult = {
  text: string;
  functionCalls: GeminiFunctionCall[];
  usage: GeminiUsage | null;
};

export function parseGeminiTurnResponse(data: unknown): GeminiTurnResult {
  const candidates = (
    data as {
      candidates?: Array<{
        content?: { parts?: Array<Record<string, unknown>> };
      }>;
    }
  )?.candidates;
  const parts = candidates?.[0]?.content?.parts || [];
  const functionCalls: GeminiFunctionCall[] = [];
  const texts: string[] = [];

  for (const part of parts) {
    const call = (part.functionCall || part.function_call) as
      | { name?: string; args?: unknown; arguments?: unknown }
      | undefined;
    if (call?.name) {
      functionCalls.push({
        name: call.name,
        args: parseArgs(call.args ?? call.arguments),
      });
      continue;
    }
    if (typeof part.text === 'string' && part.text.trim()) {
      texts.push(part.text);
    }
  }

  return {
    text: texts.join('\n').trim(),
    functionCalls,
    usage: extractGeminiUsage(data),
  };
}

export function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}
