import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JwtUser } from '../auth/identity';
import {
  canAccessImages,
  canAccessVideos,
} from '../auth/roles';
import { ImageStudioService } from '../image-studio/image-studio.service';
import { LeadService } from '../lead/lead.service';
import { LlmService } from '../llm/llm.service';
import {
  estimatePromptTokens,
  mergeGeminiUsage,
  type GeminiUsage,
} from '../llm/gemini-usage';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { VideoStudioService } from '../video-studio/video-studio.service';
import {
  CreativeToolGateway,
  isGenerationProposal,
} from './agent-tool.gateway';
import { CreativeCharacterService } from './creative-character.service';
import {
  DEFAULT_CONVERSATION_NAME,
  MAX_AGENT_TOOL_ROUNDS,
  MESSAGE_KIND,
  PROPOSE_TOOLS,
  PROPOSAL_STATUS,
  type CreativeAgentKind,
} from './agent.constants';
import { agentContentsFromMessages } from './agent.history';
import { creativeAgentSystemPrompt } from './agent.prompt';
import { geminiToolDeclarations } from './agent.tools';
import type {
  AgentTurnExtras,
  GenerationProposal,
  ImageGenerationProposal,
  StoredAgentMessage,
  VideoGenerationProposal,
} from './agent.types';
import type { CreateCreativeTurnDto } from './dto/creative-agent.dto';
import type { UpdateCreativeProposalDto } from './dto/update-proposal.dto';

const messageSelect = {
  id: true,
  role: true,
  kind: true,
  status: true,
  text: true,
  toolName: true,
  toolPayload: true,
  settings: true,
  usage: true,
  createdAt: true,
} as const;

type ConversationRef = {
  id: string;
  kind: CreativeAgentKind;
  name: string;
};

@Injectable()
export class CreativeAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly tools: CreativeToolGateway,
    private readonly imageStudio: ImageStudioService,
    private readonly videoStudio: VideoStudioService,
    private readonly leads: LeadService,
    private readonly storage: StorageService,
    private readonly characters: CreativeCharacterService,
  ) {}

  catalog(kind: CreativeAgentKind, user: JwtUser) {
    assertKindPermission(user, kind);
    return this.tools.catalog(kind);
  }

  async executeTool(
    name: string,
    dto: { kind: CreativeAgentKind; conversationId?: string; args?: Record<string, unknown> },
    user: JwtUser,
  ) {
    assertKindPermission(user, dto.kind);
    if (dto.conversationId) {
      const conversation = await this.requireConversation(dto.conversationId);
      if (conversation.kind !== dto.kind) {
        throw new BadRequestException('Conversa não combina com a modalidade');
      }
    }
    const result = await this.tools.execute(name, dto.args || {}, {
      user,
      kind: dto.kind,
      conversationId: dto.conversationId,
    });
    if (isGenerationProposal(result) && dto.conversationId) {
      const proposal = await this.persistProposal(dto.conversationId, result);
      return { name, result, proposal };
    }
    return { name, result };
  }

  async listConversations(kind: CreativeAgentKind, user: JwtUser) {
    assertKindPermission(user, kind);
    if (kind === 'image') return this.imageStudio.findAll();
    return this.videoStudio.findAll();
  }

  async createConversation(
    kind: CreativeAgentKind,
    user: JwtUser,
    name?: string,
  ) {
    assertKindPermission(user, kind);
    const title = name?.trim() || DEFAULT_CONVERSATION_NAME;
    if (kind === 'image') {
      return {
        kind,
        conversation: await this.imageStudio.create({ name: title }, user.id),
      };
    }
    return {
      kind,
      conversation: await this.videoStudio.create({ name: title }, user.id),
    };
  }

  async turn(dto: CreateCreativeTurnDto, user: JwtUser) {
    const text = dto.text.trim();
    if (!text) throw new BadRequestException('Escreva uma mensagem');

    let conversationId = dto.conversationId?.trim();
    let kind: CreativeAgentKind | undefined = dto.kind;
    if (conversationId) {
      const existing = await this.requireConversation(conversationId);
      kind = existing.kind;
    } else if (!kind) {
      throw new BadRequestException('Informe a modalidade da conversa');
    }
    assertKindPermission(user, kind);

    if (!conversationId) {
      const created = await this.createConversation(
        kind,
        user,
        titleFromText(text),
      );
      conversationId = created.conversation.id;
    }

    await this.maybeRename(conversationId, kind, text);
    const extras = extrasFromTurn(dto);
    await this.createMessage(conversationId, kind, {
      role: 'user',
      kind: MESSAGE_KIND.CHAT,
      text: appendExtras(text, extras),
      settings: extras,
    });

    const ctx = { user, kind, conversationId };
    const tools = geminiToolDeclarations(kind);
    let usage: GeminiUsage | null = null;
    let proposal: StoredAgentMessage | null = null;
    let assistantText = '';

    for (let round = 0; round < MAX_AGENT_TOOL_ROUNDS; round += 1) {
      const history = await this.listMessages(conversationId, kind);
      let turnResult;
      try {
        turnResult = await this.llm.generateTurn({
          systemInstruction: creativeAgentSystemPrompt(kind),
          contents: agentContentsFromMessages(history),
          tools,
          temperature: 0.4,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Falha no modelo de chat';
        throw new BadGatewayException(message);
      }
      usage = mergeGeminiUsage(usage, turnResult.usage);

      const calls = turnResult.functionCalls || [];
      if (!calls.length) {
        assistantText = turnResult.text;
        if (assistantText) {
          await this.createMessage(conversationId, kind, {
            role: 'assistant',
            kind: MESSAGE_KIND.CHAT,
            text: assistantText,
            usage,
          });
        }
        break;
      }

      const reads = calls.filter((call) => !PROPOSE_TOOLS.has(call.name));
      const proposes = calls.filter((call) => PROPOSE_TOOLS.has(call.name));

      if (reads.length) {
        await Promise.all(
          reads.map(async (call) => {
            const result = await this.tools.execute(call.name, call.args, ctx);
            await this.createMessage(conversationId, kind, {
              role: 'tool',
              kind: MESSAGE_KIND.TOOL,
              toolName: call.name,
              toolPayload: { args: call.args, result },
              text: call.name,
            });
          }),
        );
      }

      if (proposes.length) {
        const call = proposes[0];
        const result = await this.tools.execute(call.name, call.args, ctx);
        await this.createMessage(conversationId, kind, {
          role: 'tool',
          kind: MESSAGE_KIND.TOOL,
          toolName: call.name,
          toolPayload: { args: call.args, result },
          text: call.name,
        });
        if (!isGenerationProposal(result)) {
          throw new BadGatewayException('Proposta de geração inválida');
        }
        const merged = applyTurnExtras(result, extras);
        proposal = await this.persistProposal(conversationId, merged, usage);
        if (turnResult.text) {
          assistantText = turnResult.text;
          await this.createMessage(conversationId, kind, {
            role: 'assistant',
            kind: MESSAGE_KIND.CHAT,
            text: assistantText,
            usage,
          });
        }
        break;
      }
    }

    const conversation = await this.loadConversation(conversationId, kind);
    return {
      kind,
      conversation,
      proposal,
      usage,
      text: assistantText,
    };
  }

  async updateProposal(
    conversationId: string,
    proposalId: string,
    dto: UpdateCreativeProposalDto,
    user: JwtUser,
  ) {
    const conversation = await this.requireConversation(conversationId);
    assertKindPermission(user, conversation.kind);
    const current = await this.requireProposal(conversationId, conversation.kind, proposalId);
    const spec = mergeProposal(asProposal(current.settings, conversation.kind), dto);
    const updated = await this.updateMessage(conversationId, conversation.kind, proposalId, {
      text: spec.prompt,
      settings: spec,
    });
    return { kind: conversation.kind, proposal: updated };
  }

  async cancelProposal(
    conversationId: string,
    proposalId: string,
    user: JwtUser,
  ) {
    const conversation = await this.requireConversation(conversationId);
    assertKindPermission(user, conversation.kind);
    await this.requireProposal(conversationId, conversation.kind, proposalId);
    const updated = await this.updateMessage(conversationId, conversation.kind, proposalId, {
      status: PROPOSAL_STATUS.CANCELLED,
    });
    return { kind: conversation.kind, proposal: updated };
  }

  async confirmProposal(
    conversationId: string,
    proposalId: string,
    user: JwtUser,
  ) {
    const conversation = await this.requireConversation(conversationId);
    assertKindPermission(user, conversation.kind);
    const pending = await this.requireProposal(
      conversationId,
      conversation.kind,
      proposalId,
    );
    const spec = asProposal(pending.settings, conversation.kind);

    if (spec.kind === 'image') {
      const referenceAssetIds = await this.attachLeadImagesToImage(
        conversationId,
        spec,
        user,
      );
      const character = await this.attachCharacterToImage(
        conversationId,
        spec,
        referenceAssetIds,
      );
      const generated = await this.imageStudio.generate(conversationId, {
        prompt: spec.prompt,
        model: spec.model,
        temperature: spec.temperature,
        aspectRatio: spec.aspectRatio,
        imageSize: spec.imageSize,
        systemInstruction: character.systemInstruction || spec.systemInstruction,
        googleSearch: spec.googleSearch,
        referenceAssetIds: character.referenceAssetIds,
      });
      await this.updateMessage(conversationId, 'image', proposalId, {
        status: PROPOSAL_STATUS.CONFIRMED,
      });
      return {
        kind: 'image' as const,
        conversation: await this.imageStudio.findById(conversationId),
        generated,
      };
    }

    const frames = await this.attachLeadImagesToVideo(conversationId, spec, user);
    const characterFrames = await this.attachCharacterToVideo(
      conversationId,
      spec,
      frames,
    );
    const generated = await this.videoStudio.generate(conversationId, {
      prompt: [spec.prompt, characterFrames.promptSuffix]
        .filter(Boolean)
        .join('\n'),
      model: spec.model,
      aspectRatio: spec.aspectRatio,
      duration: spec.duration,
      resolution: spec.resolution,
      thinkingLevel: spec.thinkingLevel,
      firstFrameImageAssetId: spec.firstFrameImageAssetId,
      lastFrameImageAssetId: spec.lastFrameImageAssetId,
      firstFrameAssetId:
        characterFrames.firstFrameAssetId ||
        frames.firstFrameAssetId ||
        spec.firstFrameAssetId,
      lastFrameAssetId: spec.lastFrameAssetId,
    });
    await this.updateMessage(conversationId, 'video', proposalId, {
      status: PROPOSAL_STATUS.CONFIRMED,
    });
    return {
      kind: 'video' as const,
      conversation: await this.videoStudio.findById(conversationId),
      generated,
    };
  }

  private async persistProposal(
    conversationId: string,
    spec: GenerationProposal,
    usage?: GeminiUsage | null,
  ) {
    const conversation = await this.requireConversation(conversationId);
    await this.cancelPendingProposals(conversationId, conversation.kind);
    return this.createMessage(conversationId, conversation.kind, {
      role: 'assistant',
      kind: MESSAGE_KIND.PROPOSAL,
      status: PROPOSAL_STATUS.PENDING,
      text: spec.prompt,
      settings: spec,
      usage: usage || null,
    });
  }

  private async cancelPendingProposals(
    conversationId: string,
    kind: CreativeAgentKind,
  ) {
    if (kind === 'image') {
      await this.prisma.imageMessage.updateMany({
        where: {
          projectId: conversationId,
          kind: MESSAGE_KIND.PROPOSAL,
          status: PROPOSAL_STATUS.PENDING,
        },
        data: { status: PROPOSAL_STATUS.CANCELLED },
      });
      return;
    }
    await this.prisma.videoMessage.updateMany({
      where: {
        projectId: conversationId,
        kind: MESSAGE_KIND.PROPOSAL,
        status: PROPOSAL_STATUS.PENDING,
      },
      data: { status: PROPOSAL_STATUS.CANCELLED },
    });
  }

  private async attachLeadImagesToImage(
    projectId: string,
    spec: ImageGenerationProposal,
    user: JwtUser,
  ): Promise<string[] | undefined> {
    const refs = [...(spec.referenceAssetIds || [])];
    const leadImageIds = spec.leadImageIds || [];
    if (!leadImageIds.length) return refs;
    if (!spec.leadId) {
      throw new BadRequestException('Fotos de lead exigem leadId');
    }
    const files = await this.readLeadImageFiles(spec.leadId, leadImageIds, user);
    if (files.length) {
      const created = await this.imageStudio.addReferences(projectId, files);
      refs.push(...created.map((asset) => asset.id));
    }
    return [...new Set(refs)];
  }

  private async attachCharacterToImage(
    projectId: string,
    spec: ImageGenerationProposal,
    refs: string[] | undefined,
  ): Promise<{
    referenceAssetIds?: string[];
    systemInstruction?: string;
  }> {
    const nextRefs = [...(refs || [])];
    if (!spec.characterId) {
      return { referenceAssetIds: nextRefs, systemInstruction: spec.systemInstruction };
    }
    const { character, files } = await this.characters.identityImageFiles(
      spec.characterId,
    );
    if (files.length) {
      const created = await this.imageStudio.addReferences(projectId, files);
      nextRefs.push(...created.map((asset) => asset.id));
    }
    const identity = character.identityPrompt?.trim();
    const systemInstruction = [spec.systemInstruction?.trim(), identity]
      .filter(Boolean)
      .join('\n');
    return {
      referenceAssetIds: [...new Set(nextRefs)],
      systemInstruction: systemInstruction || spec.systemInstruction,
    };
  }

  private async attachCharacterToVideo(
    projectId: string,
    spec: VideoGenerationProposal,
    frames: { firstFrameAssetId?: string },
  ): Promise<{ firstFrameAssetId?: string; promptSuffix?: string }> {
    if (!spec.characterId) return frames;
    const { character, files } = await this.characters.identityImageFiles(
      spec.characterId,
    );
    const promptSuffix = character.identityPrompt?.trim() || undefined;
    if (
      spec.firstFrameImageAssetId ||
      spec.firstFrameAssetId ||
      frames.firstFrameAssetId
    ) {
      return { ...frames, promptSuffix };
    }
    if (!files.length) return { ...frames, promptSuffix };
    const created = await this.videoStudio.addFrames(projectId, 'first-frame', [
      files[0],
    ]);
    return { firstFrameAssetId: created[0]?.id, promptSuffix };
  }

  private async attachLeadImagesToVideo(
    projectId: string,
    spec: VideoGenerationProposal,
    user: JwtUser,
  ): Promise<{ firstFrameAssetId?: string }> {
    if (spec.firstFrameImageAssetId || spec.firstFrameAssetId) {
      return {};
    }
    const leadImageIds = spec.leadImageIds || [];
    if (!leadImageIds.length || !spec.leadId) return {};
    const files = await this.readLeadImageFiles(spec.leadId, leadImageIds, user);
    if (!files.length) return {};
    const created = await this.videoStudio.addFrames(projectId, 'first-frame', [
      files[0],
    ]);
    return { firstFrameAssetId: created[0]?.id };
  }

  private async readLeadImageFiles(
    leadId: string,
    imageIds: string[],
    user: JwtUser,
  ) {
    const lead = (await this.leads.findById(leadId, user)) as {
      images?: Array<{
        id: string;
        localPath?: string | null;
        filename?: string | null;
        mimeType?: string | null;
      }>;
    };
    const wanted = new Set(imageIds);
    const files: Array<{
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    }> = [];
    for (const image of lead.images || []) {
      if (!wanted.has(image.id) || !image.localPath) continue;
      const buffer = await this.storage.readStorageFile(image.localPath);
      if (!buffer?.length) continue;
      files.push({
        buffer,
        originalname: image.filename || 'lead-photo.jpg',
        mimetype: image.mimeType || 'image/jpeg',
        size: buffer.length,
      });
    }
    return files;
  }

  private async requireConversation(id: string): Promise<ConversationRef> {
    const image = await this.prisma.imageProject.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (image) return { id: image.id, kind: 'image', name: image.name };
    const video = await this.prisma.videoProject.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (video) return { id: video.id, kind: 'video', name: video.name };
    throw new NotFoundException(`Conversa ${id} não encontrada`);
  }

  private async loadConversation(id: string, kind: CreativeAgentKind) {
    if (kind === 'image') return this.imageStudio.findById(id);
    return this.videoStudio.findById(id);
  }

  private async maybeRename(
    id: string,
    kind: CreativeAgentKind,
    text: string,
  ) {
    const current = await this.requireConversation(id);
    if (
      current.name !== DEFAULT_CONVERSATION_NAME &&
      current.name !== 'Novo projeto'
    ) {
      return;
    }
    const name = titleFromText(text);
    if (kind === 'image') {
      await this.imageStudio.update(id, { name });
      return;
    }
    await this.videoStudio.update(id, { name });
  }

  private async listMessages(
    id: string,
    kind: CreativeAgentKind,
  ): Promise<StoredAgentMessage[]> {
    if (kind === 'image') {
      return this.prisma.imageMessage.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'asc' },
        select: messageSelect,
      }) as Promise<StoredAgentMessage[]>;
    }
    return this.prisma.videoMessage.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      select: messageSelect,
    }) as Promise<StoredAgentMessage[]>;
  }

  private async createMessage(
    id: string,
    kind: CreativeAgentKind,
    data: {
      role: string;
      kind: string;
      status?: string;
      text?: string;
      toolName?: string;
      toolPayload?: unknown;
      settings?: unknown;
      usage?: GeminiUsage | null;
    },
  ): Promise<StoredAgentMessage> {
    const payload = {
      projectId: id,
      role: data.role,
      kind: data.kind,
      status: data.status || null,
      text: data.text || null,
      toolName: data.toolName || null,
      toolPayload:
        data.toolPayload === undefined
          ? undefined
          : (data.toolPayload as Prisma.InputJsonValue),
      settings:
        data.settings === undefined
          ? undefined
          : (data.settings as Prisma.InputJsonValue),
      usage: data.usage || undefined,
    };
    if (kind === 'image') {
      return this.prisma.imageMessage.create({ data: payload }) as Promise<StoredAgentMessage>;
    }
    return this.prisma.videoMessage.create({ data: payload }) as Promise<StoredAgentMessage>;
  }

  private async updateMessage(
    conversationId: string,
    kind: CreativeAgentKind,
    messageId: string,
    data: {
      status?: string;
      text?: string;
      settings?: unknown;
    },
  ) {
    const payload = {
      status: data.status,
      text: data.text,
      settings: data.settings as Prisma.InputJsonValue | undefined,
    };
    if (kind === 'image') {
      return this.prisma.imageMessage.update({
        where: { id: messageId },
        data: payload,
      });
    }
    return this.prisma.videoMessage.update({
      where: { id: messageId },
      data: payload,
    });
  }

  private async requireProposal(
    conversationId: string,
    kind: CreativeAgentKind,
    proposalId: string,
  ) {
    const message =
      kind === 'image'
        ? await this.prisma.imageMessage.findFirst({
            where: { id: proposalId, projectId: conversationId },
          })
        : await this.prisma.videoMessage.findFirst({
            where: { id: proposalId, projectId: conversationId },
          });
    if (!message || message.kind !== MESSAGE_KIND.PROPOSAL) {
      throw new NotFoundException('Proposta não encontrada');
    }
    if (message.status !== PROPOSAL_STATUS.PENDING) {
      throw new BadRequestException('Esta proposta não está pendente');
    }
    return message;
  }
}

function assertKindPermission(user: JwtUser, kind: CreativeAgentKind) {
  if (kind === 'image' && !canAccessImages(user)) {
    throw new ForbiddenException('Sem permissão de imagens');
  }
  if (kind === 'video' && !canAccessVideos(user)) {
    throw new ForbiddenException('Sem permissão de vídeos');
  }
}

function titleFromText(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 60) || DEFAULT_CONVERSATION_NAME;
}

function extrasFromTurn(dto: CreateCreativeTurnDto): AgentTurnExtras {
  return {
    referenceAssetIds: dto.referenceAssetIds,
    firstFrameImageAssetId: dto.firstFrameImageAssetId,
    lastFrameImageAssetId: dto.lastFrameImageAssetId,
    firstFrameAssetId: dto.firstFrameAssetId,
    lastFrameAssetId: dto.lastFrameAssetId,
  };
}

function appendExtras(text: string, extras: AgentTurnExtras): string {
  const notes: string[] = [];
  if (extras.referenceAssetIds?.length) {
    notes.push(
      `Referências anexadas: ${extras.referenceAssetIds.join(', ')}`,
    );
  }
  if (extras.firstFrameImageAssetId || extras.firstFrameAssetId) {
    notes.push(
      `Quadro inicial: ${extras.firstFrameImageAssetId || extras.firstFrameAssetId}`,
    );
  }
  if (extras.lastFrameImageAssetId || extras.lastFrameAssetId) {
    notes.push(
      `Quadro final: ${extras.lastFrameImageAssetId || extras.lastFrameAssetId}`,
    );
  }
  if (!notes.length) return text;
  return `${text}\n\n[${notes.join(' · ')}]`;
}

function applyTurnExtras(
  spec: GenerationProposal,
  extras: AgentTurnExtras,
): GenerationProposal {
  if (spec.kind === 'image') {
    const refs = [
      ...(spec.referenceAssetIds || []),
      ...(extras.referenceAssetIds || []),
    ];
    return {
      ...spec,
      referenceAssetIds: [...new Set(refs)],
      estimatedTokens: estimatePromptTokens(
        spec.prompt,
        (spec.referenceAssetIds?.length || 0) + (spec.leadImageIds?.length || 0),
      ),
    };
  }
  return {
    ...spec,
    firstFrameImageAssetId:
      spec.firstFrameImageAssetId || extras.firstFrameImageAssetId,
    lastFrameImageAssetId:
      spec.lastFrameImageAssetId || extras.lastFrameImageAssetId,
    firstFrameAssetId: spec.firstFrameAssetId || extras.firstFrameAssetId,
    lastFrameAssetId: spec.lastFrameAssetId || extras.lastFrameAssetId,
  };
}

function asProposal(
  settings: unknown,
  kind: CreativeAgentKind,
): GenerationProposal {
  if (isGenerationProposal(settings) && settings.kind === kind) {
    return settings;
  }
  throw new BadRequestException('Proposta inválida');
}

function mergeProposal(
  spec: GenerationProposal,
  dto: UpdateCreativeProposalDto,
): GenerationProposal {
  const next = {
    ...spec,
    ...(dto.prompt !== undefined ? { prompt: dto.prompt.trim() } : {}),
    ...(dto.model !== undefined ? { model: dto.model } : {}),
    ...(dto.rationale !== undefined ? { rationale: dto.rationale } : {}),
    ...(dto.leadId !== undefined ? { leadId: dto.leadId } : {}),
    ...(dto.leadLabel !== undefined ? { leadLabel: dto.leadLabel } : {}),
    ...(dto.leadImageIds !== undefined ? { leadImageIds: dto.leadImageIds } : {}),
    ...(dto.characterId !== undefined ? { characterId: dto.characterId } : {}),
  };
  if (!next.prompt) throw new BadRequestException('Informe o prompt');
  if (next.kind === 'image') {
    const merged: ImageGenerationProposal = {
      ...next,
      ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
      ...(dto.aspectRatio !== undefined ? { aspectRatio: dto.aspectRatio } : {}),
      ...(dto.imageSize !== undefined ? { imageSize: dto.imageSize } : {}),
      ...(dto.systemInstruction !== undefined
        ? { systemInstruction: dto.systemInstruction }
        : {}),
      ...(dto.googleSearch !== undefined ? { googleSearch: dto.googleSearch } : {}),
      ...(dto.referenceAssetIds !== undefined
        ? { referenceAssetIds: dto.referenceAssetIds }
        : {}),
    };
    merged.estimatedTokens = estimatePromptTokens(
      merged.prompt,
      (merged.referenceAssetIds?.length || 0) + (merged.leadImageIds?.length || 0),
    );
    return merged;
  }
  const merged: VideoGenerationProposal = {
    ...next,
    ...(dto.aspectRatio !== undefined ? { aspectRatio: dto.aspectRatio } : {}),
    ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
    ...(dto.resolution !== undefined ? { resolution: dto.resolution } : {}),
    ...(dto.thinkingLevel !== undefined ? { thinkingLevel: dto.thinkingLevel } : {}),
    ...(dto.firstFrameImageAssetId !== undefined
      ? { firstFrameImageAssetId: dto.firstFrameImageAssetId }
      : {}),
    ...(dto.lastFrameImageAssetId !== undefined
      ? { lastFrameImageAssetId: dto.lastFrameImageAssetId }
      : {}),
    ...(dto.firstFrameAssetId !== undefined
      ? { firstFrameAssetId: dto.firstFrameAssetId }
      : {}),
    ...(dto.lastFrameAssetId !== undefined
      ? { lastFrameAssetId: dto.lastFrameAssetId }
      : {}),
  };
  merged.estimatedTokens = estimatePromptTokens(merged.prompt, 0);
  return merged;
}
