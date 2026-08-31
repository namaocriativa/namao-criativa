export type LlmRole = 'plan' | 'code' | 'vision' | 'chat';
export type LlmProvider = 'ollama' | 'gemini';

export type RoleConfig = {
  provider: LlmProvider;
  model: string;
};

export type LlmSettings = {
  roles: Record<LlmRole, RoleConfig>;
};

export type RoleStatus = RoleConfig & {
  ok: boolean;
  error?: string;
};

export const LLM_ROLES: LlmRole[] = ['plan', 'code', 'vision', 'chat'];

export const GEMINI_DEFAULTS: Record<LlmRole, string> = {
  plan: 'gemini-2.5-flash',
  code: 'gemini-2.5-flash',
  vision: 'gemini-2.5-flash',
  chat: 'gemini-2.5-flash',
};

export const GEMINI_SUGGESTED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

export const LLM_STAGES: Array<{
  id: string;
  label: string;
  role: LlmRole;
}> = [
  {
    id: 'vision',
    label: 'Análise de imagens (logo/fotos)',
    role: 'vision',
  },
  {
    id: 'art_director',
    label: 'Direção criativa',
    role: 'plan',
  },
  {
    id: 'page_architect',
    label: 'Arquitetura da página',
    role: 'plan',
  },
  {
    id: 'copywriter',
    label: 'Copywriter (props de cada seção)',
    role: 'code',
  },
  {
    id: 'visual_review',
    label: 'Review visual',
    role: 'vision',
  },
];

export const LLM_SETTING_KEY = 'llm';
