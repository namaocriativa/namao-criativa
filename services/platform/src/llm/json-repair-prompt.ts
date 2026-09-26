export function buildJsonRepairPrompt(raw: string, expected: string): string {
  return `A resposta abaixo deveria ser JSON válido no formato: ${expected}.
Corrija e devolva SOMENTE o JSON válido, sem markdown.

Resposta original:
${raw.slice(0, 12000)}`;
}
