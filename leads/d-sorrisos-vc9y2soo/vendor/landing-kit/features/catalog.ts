export type FeatureStatus = 'ready' | 'planned';

export type FeatureCategory = 'ai' | 'capture' | 'conversion' | 'content';

export type FeatureMetadata = {
  id: string;
  category: FeatureCategory;
  name: string;
  description: string;
  status: FeatureStatus;
  requiredBriefFields: string[];
  propsSchema: Record<string, string>;
  llmContract: string;
};

export const AI_CHAT_FEATURE_ID = 'features.ai-chat';
export const AI_CONCIERGE_FEATURE_ID = 'features.ai-concierge';

export const CHAT_RUNTIME_FEATURE_IDS = [
  AI_CHAT_FEATURE_ID,
  AI_CONCIERGE_FEATURE_ID,
] as const;

export function isChatRuntimeFeature(id: string): boolean {
  return (CHAT_RUNTIME_FEATURE_IDS as readonly string[]).includes(id);
}

export const FEATURE_CATALOG: FeatureMetadata[] = [
  {
    id: AI_CHAT_FEATURE_ID,
    category: 'ai',
    name: 'AI Chat',
    description: 'Chat flutuante com contexto da landing page',
    status: 'ready',
    requiredBriefFields: ['name'],
    propsSchema: {
      suggestions: 'string[3]',
      position: 'bottom-right | bottom-left',
      showWhatsappCta: 'boolean',
    },
    llmContract:
      'Floating chat. Do not invent legal advice. Use trusted brief only.',
  },
  {
    id: AI_CONCIERGE_FEATURE_ID,
    category: 'ai',
    name: 'AI Concierge',
    description: 'Assistente que encaminha o visitante para o próximo passo',
    status: 'ready',
    requiredBriefFields: ['name'],
    propsSchema: {
      greeting: 'string',
      actions: 'string[3]',
      position: 'bottom-right | bottom-left',
      showWhatsappCta: 'boolean',
    },
    llmContract:
      'Guided concierge. Open with greeting and 3 actions. Steer to a next step (WhatsApp, contact, or a service). Do not invent legal advice.',
  },
  {
    id: 'features.ai-qualification',
    category: 'ai',
    name: 'Qualificação IA',
    description: 'Classifica o visitante (HOT/WARM/COLD) durante o chat',
    status: 'planned',
    requiredBriefFields: ['name'],
    propsSchema: {},
    llmContract: 'Lead qualification. Planned — do not emit this id.',
  },
  {
    id: 'features.ai-quote',
    category: 'ai',
    name: 'Orçamento IA',
    description: 'Coleta dados para um orçamento preliminar',
    status: 'planned',
    requiredBriefFields: ['services'],
    propsSchema: {},
    llmContract: 'Quote assistant. Planned — do not emit this id.',
  },
  {
    id: 'features.ai-faq',
    category: 'ai',
    name: 'FAQ IA',
    description: 'Responde só com o FAQ da página',
    status: 'planned',
    requiredBriefFields: ['name'],
    propsSchema: {},
    llmContract: 'FAQ-only assistant. Planned — do not emit this id.',
  },
  {
    id: 'features.lead-form',
    category: 'capture',
    name: 'Formulário de lead',
    description: 'Captura nome, contato e mensagem',
    status: 'planned',
    requiredBriefFields: ['name'],
    propsSchema: {},
    llmContract: 'Lead form. Planned — do not emit this id.',
  },
  {
    id: 'features.whatsapp-cta',
    category: 'conversion',
    name: 'CTA WhatsApp',
    description: 'Botão persistente para WhatsApp',
    status: 'planned',
    requiredBriefFields: ['whatsapp'],
    propsSchema: {},
    llmContract: 'WhatsApp CTA. Planned — do not emit this id.',
  },
  {
    id: 'features.quiz',
    category: 'capture',
    name: 'Quiz',
    description: 'Questionário curto de qualificação',
    status: 'planned',
    requiredBriefFields: ['name'],
    propsSchema: {},
    llmContract: 'Quiz. Planned — do not emit this id.',
  },
  {
    id: 'features.map',
    category: 'content',
    name: 'Mapa',
    description: 'Mapa com o endereço público do negócio',
    status: 'planned',
    requiredBriefFields: ['address'],
    propsSchema: {},
    llmContract: 'Map embed. Planned — do not emit this id.',
  },
  {
    id: 'features.sticky-cta',
    category: 'conversion',
    name: 'CTA fixo',
    description: 'Barra de ação fixa no rodapé',
    status: 'planned',
    requiredBriefFields: ['name'],
    propsSchema: {},
    llmContract: 'Sticky CTA. Planned — do not emit this id.',
  },
];

export function getFeatureMeta(id: string): FeatureMetadata | undefined {
  return FEATURE_CATALOG.find((item) => item.id === id);
}

export function coerceFeatureId(
  raw: string,
  allowedIds?: string[],
): string | null {
  const id = String(raw || '').trim();
  const found = FEATURE_CATALOG.find((item) => item.id === id);
  if (!found || found.status !== 'ready') return null;
  if (allowedIds?.length && !allowedIds.includes(found.id)) return null;
  return found.id;
}

export function toLlmFeatureCatalog(allowedIds?: string[]) {
  return FEATURE_CATALOG.filter((item) => {
    if (item.status !== 'ready') return false;
    if (allowedIds?.length && !allowedIds.includes(item.id)) return false;
    return true;
  }).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    llmContract: item.llmContract,
    propsSchema: item.propsSchema,
  }));
}
