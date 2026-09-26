import type { LeadBrief } from '../owner/lead-brief';

export const SITE_PROMPT_TEMPLATE = `vamos criar uma landing para @{Instagram}
analise o instagram e as necessidades para o site ser focado em conversão para a pessoa ou para o negócio do pessoa.
pense para SEO e ser encontrado organicamente no google.
o site precisa ser moderno.

use este video como hero background
video1.mp4
use este video como video autoridade reels
video2.mp4

use motion.dev
use three.js para criar algo que faça sentindo(se fizer)e que combine com o site
`;

export function buildLeadPromptRewriteTask(
  brief: LeadBrief,
  notes: string,
  extraImages: string[],
): string {
  return `Reescreva o prompt abaixo para gerar o site DESTE negócio. Use só fatos do brief. Não invente telefone, endereço ou Instagram. Melhore clareza, SEO e conversão quando o brief permitir.

## Brief
${JSON.stringify(brief, null, 2)}

## Notas do operador
${notes.trim() || '(nenhuma)'}

## Imagens extras do modal
${extraImages.length ? extraImages.map((name) => `- ${name}`).join('\n') : '(nenhuma)'}

## Prompt base
${SITE_PROMPT_TEMPLATE}

Devolva JSON: { "prompt": "markdown do prompt adaptado" }`;
}

export function parseLeadPrompt(value: unknown): { prompt: string } {
  if (!value || typeof value !== 'object') {
    throw new Error('prompt inválido');
  }
  const prompt = String((value as { prompt?: unknown }).prompt || '').trim();
  if (prompt.length < 40) throw new Error('prompt curto demais');
  return { prompt };
}
