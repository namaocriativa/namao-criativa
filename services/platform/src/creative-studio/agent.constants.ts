export const CREATIVE_AGENT_KIND = {
  IMAGE: 'image',
  VIDEO: 'video',
} as const;

export type CreativeAgentKind =
  (typeof CREATIVE_AGENT_KIND)[keyof typeof CREATIVE_AGENT_KIND];

export const MESSAGE_KIND = {
  CHAT: 'chat',
  TOOL: 'tool',
  PROPOSAL: 'proposal',
  GENERATION: 'generation',
} as const;

export type CreativeMessageKind =
  (typeof MESSAGE_KIND)[keyof typeof MESSAGE_KIND];

export const PROPOSAL_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
} as const;

export const MAX_AGENT_TOOL_ROUNDS = 6;
export const MAX_TOOL_RESULT_CHARS = 16_000;
export const TOOL_TIMEOUT_MS = 15_000;
export const MAX_SEARCH_LEADS = 10;

export const PROPOSE_IMAGE_TOOL = 'propose_image_generation';
export const PROPOSE_VIDEO_TOOL = 'propose_video_generation';

export const PROPOSE_TOOLS = new Set([PROPOSE_IMAGE_TOOL, PROPOSE_VIDEO_TOOL]);

export const DEFAULT_CONVERSATION_NAME = 'Nova conversa';
