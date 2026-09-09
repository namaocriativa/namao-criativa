export function parseJsonValue(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const fenceMatch = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const m of [...fenceMatch].reverse()) {
    try {
      return JSON.parse(m[1].trim());
    } catch {
      // try next
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error('Não foi possível extrair JSON da resposta do Gemini');
}
