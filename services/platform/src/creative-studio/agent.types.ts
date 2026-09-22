import type { JwtUser } from '../auth/identity';
import type { GeminiUsage } from '../llm/gemini-usage';
import type { CreativeAgentKind } from './agent.constants';

export type CreativeToolContext = {
  user: JwtUser;
  kind: CreativeAgentKind;
  conversationId?: string;
};

export type CreativeToolDefinition = {
  name: string;
  description: string;
  kinds: CreativeAgentKind[];
  parameters: Record<string, unknown>;
};

export type ImageGenerationProposal = {
  kind: 'image';
  prompt: string;
  model?: string;
  temperature?: number;
  aspectRatio?: string;
  imageSize?: string;
  systemInstruction?: string;
  googleSearch?: boolean;
  referenceAssetIds?: string[];
  leadId?: string;
  leadLabel?: string;
  leadImageIds?: string[];
  characterId?: string;
  rationale?: string;
  estimatedTokens: number;
};

export type VideoGenerationProposal = {
  kind: 'video';
  prompt: string;
  model?: string;
  aspectRatio?: string;
  duration?: string;
  resolution?: string;
  thinkingLevel?: string;
  firstFrameImageAssetId?: string;
  lastFrameImageAssetId?: string;
  firstFrameAssetId?: string;
  lastFrameAssetId?: string;
  leadId?: string;
  leadLabel?: string;
  leadImageIds?: string[];
  characterId?: string;
  rationale?: string;
  estimatedTokens: number;
};

export type GenerationProposal =
  | ImageGenerationProposal
  | VideoGenerationProposal;

export type CreativeToolCatalogItem = CreativeToolDefinition;

export type AgentTurnExtras = {
  referenceAssetIds?: string[];
  firstFrameImageAssetId?: string;
  lastFrameImageAssetId?: string;
  firstFrameAssetId?: string;
  lastFrameAssetId?: string;
};

export type StoredAgentMessage = {
  id: string;
  role: string;
  kind: string;
  status?: string | null;
  text?: string | null;
  toolName?: string | null;
  toolPayload?: unknown;
  settings?: unknown;
  usage?: unknown;
  createdAt?: Date | string;
};
