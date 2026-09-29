import type { LeadBrief } from '../owner/lead-brief';
import {
  SITE_OBJECTIVE_LABELS,
  type SiteApprovedBrief,
} from './site-skill.contract';

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
  approved?: SiteApprovedBrief | null,
): string {
  return `Reescreva o prompt abaixo para gerar o site DESTE negócio. Use só fatos do brief e da estrutura aprovada. Não invente telefone, WhatsApp, endereço, preço, disponibilidade ou Instagram. Melhore clareza, SEO e conversão quando o brief permitir.

## Brief
${JSON.stringify(brief, null, 2)}

## Estrutura aprovada
${approvedBlock(approved)}

## Notas do operador
${notes.trim() || '(nenhuma)'}

## Imagens extras do modal
${extraImages.length ? extraImages.map((name) => `- ${name}`).join('\n') : '(nenhuma)'}

## Prompt base
${SITE_PROMPT_TEMPLATE}

Devolva JSON: { "prompt": "markdown do prompt adaptado" }`;
}

function approvedBlock(approved?: SiteApprovedBrief | null): string {
  if (!approved) return '(nenhuma — siga só o brief)';
  const sections = approved.sections
    .map(
      (section, index) =>
        `${index + 1}. ${section.title} (${section.kind}) — ${section.purpose}${
          section.cta ? ` CTA: ${section.cta}` : ''
        }`,
    )
    .join('\n');
  const gaps = approved.gaps.length
    ? approved.gaps.map((gap) => `- ${gap.label}: ${gap.note}`).join('\n')
    : '(nenhuma)';
  const images = approved.images.length
    ? approved.images
        .map(
          (image) => `- ${image.filename} → ${image.section} (${image.kind})`,
        )
        .join('\n')
    : '(nenhuma)';
  return `Objetivo: ${SITE_OBJECTIVE_LABELS[approved.objective]}
Nota: ${approved.objectiveNote || '(nenhuma)'}
Seções:
${sections}
Lacunas (não inventar):
${gaps}
Imagens e seções:
${images}`;
}

export function parseLeadPrompt(value: unknown): { prompt: string } {
  if (!value || typeof value !== 'object') {
    throw new Error('prompt inválido');
  }
  const prompt = String((value as { prompt?: unknown }).prompt || '').trim();
  if (prompt.length < 40) throw new Error('prompt curto demais');
  return { prompt };
}
