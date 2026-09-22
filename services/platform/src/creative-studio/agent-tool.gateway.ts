import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import type { JwtUser } from '../auth/identity';
import { estimatePromptTokens } from '../llm/gemini-usage';
import { buildLeadBrief } from '../landing/lead-brief';
import type { LeadLike } from '../landing/prompt.builder';
import { ImageStudioService } from '../image-studio/image-studio.service';
import { LeadService } from '../lead/lead.service';
import { PackagesService } from '../packages/packages.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import { CreativeCharacterService } from './creative-character.service';
import {
  MAX_SEARCH_LEADS,
  MAX_TOOL_RESULT_CHARS,
  PROPOSE_IMAGE_TOOL,
  PROPOSE_VIDEO_TOOL,
  TOOL_TIMEOUT_MS,
  type CreativeAgentKind,
} from './agent.constants';
import { findCreativeTool, toolsForKind } from './agent.tools';
import type {
  CreativeToolContext,
  GenerationProposal,
  ImageGenerationProposal,
  VideoGenerationProposal,
} from './agent.types';

@Injectable()
export class CreativeToolGateway {
  constructor(
    private readonly leads: LeadService,
    private readonly access: StudioLeadAccessService,
    private readonly packages: PackagesService,
    private readonly prisma: PrismaService,
    private readonly imageStudio: ImageStudioService,
    private readonly characters: CreativeCharacterService,
  ) {}

  catalog(kind: CreativeAgentKind) {
    return {
      kind,
      tools: toolsForKind(kind).map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    };
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: CreativeToolContext,
  ): Promise<unknown> {
    const tool = findCreativeTool(name, ctx.kind);
    if (!tool) {
      throw new BadRequestException(`Tool não permitida: ${name}`);
    }
    return withTimeout(this.dispatch(name, args, ctx), TOOL_TIMEOUT_MS);
  }

  private async dispatch(
    name: string,
    args: Record<string, unknown>,
    ctx: CreativeToolContext,
  ): Promise<unknown> {
    switch (name) {
      case 'search_leads':
        return this.searchLeads(args, ctx.user);
      case 'get_lead':
        return this.getLead(args, ctx.user);
      case 'list_lead_images':
        return this.listLeadImages(args, ctx.user);
      case 'list_packages':
        return this.listPackages(args);
      case 'list_characters':
        return this.listCharacters(args);
      case 'get_character':
        return this.getCharacter(args);
      case 'list_conversation_assets':
        return this.listConversationAssets(args, ctx);
      case 'list_image_library':
        return this.listImageLibrary(ctx);
      case PROPOSE_IMAGE_TOOL:
        return proposeImage(args);
      case PROPOSE_VIDEO_TOOL:
        return proposeVideo(args);
      default:
        throw new BadRequestException(`Tool desconhecida: ${name}`);
    }
  }

  private async searchLeads(args: Record<string, unknown>, user: JwtUser) {
    const query = String(args.query || '')
      .trim()
      .toLowerCase();
    const leads = await this.leads.findAll(user);
    const matches = leads.filter((lead) => {
      if (!query) return true;
      return [lead.name, lead.category, lead.city, lead.state]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
    return truncateJson({
      leads: matches.slice(0, MAX_SEARCH_LEADS).map((lead) => ({
        id: lead.id,
        name: lead.name,
        category: lead.category || null,
        city: lead.city || null,
        state: lead.state || null,
        imageCount: lead._count?.images ?? 0,
      })),
    });
  }

  private async getLead(args: Record<string, unknown>, user: JwtUser) {
    const leadId = requiredId(args.leadId, 'leadId');
    await this.access.assertCanAccess(user, leadId);
    const lead = await this.leads.findById(leadId, user);
    const brief = buildLeadBrief(lead as LeadLike);
    const images = Array.isArray((lead as { images?: unknown }).images)
      ? (
          lead as {
            images: Array<{
              id?: string;
              filename?: string | null;
              sourceUrl?: string | null;
            }>;
          }
        ).images
      : [];
    return truncateJson({
      id: brief.leadId,
      name: brief.name,
      category: brief.category,
      description: brief.description,
      services: brief.services,
      city: brief.city,
      state: brief.state,
      contacts: brief.contacts,
      images: images.slice(0, 8).map((image) => ({
        id: image.id,
        filename: image.filename || null,
        kind: /logo/i.test(`${image.filename || ''} ${image.sourceUrl || ''}`)
          ? 'logo'
          : 'photo',
      })),
    });
  }

  private async listLeadImages(args: Record<string, unknown>, user: JwtUser) {
    const leadId = requiredId(args.leadId, 'leadId');
    await this.access.assertCanAccess(user, leadId);
    const lead = (await this.leads.findById(leadId, user)) as {
      images?: Array<{
        id: string;
        filename?: string | null;
        mimeType?: string | null;
        sourceUrl?: string | null;
        localPath?: string | null;
      }>;
    };
    const images = (lead.images || []).filter((image) => {
      if (!image.localPath) return false;
      return !/logo/i.test(`${image.filename || ''} ${image.sourceUrl || ''}`);
    });
    return truncateJson({
      images: images.slice(0, 8).map((image) => ({
        id: image.id,
        filename: image.filename || null,
        mimeType: image.mimeType || null,
      })),
    });
  }

  private async listPackages(args: Record<string, unknown>) {
    const query = String(args.query || '')
      .trim()
      .toLowerCase();
    const all = await this.packages.findAll();
    const active = all.filter((item) => item.status === 'active');
    const pool = active.length ? active : all;
    const matches = pool.filter((item) => {
      if (!query) return true;
      return `${item.name} ${item.summary || ''}`.toLowerCase().includes(query);
    });
    return truncateJson({
      packages: matches.slice(0, 20).map((item) => ({
        id: item.id,
        name: item.name,
        summary: item.summary,
        price: item.price,
        currency: item.currency,
        status: item.status,
      })),
    });
  }

  private async listCharacters(args: Record<string, unknown>) {
    const query = String(args.query || '')
      .trim()
      .toLowerCase();
    const all = await this.characters.findAll();
    const matches = all.filter((item) => {
      if (!query) return true;
      return `${item.name} ${item.appearance}`.toLowerCase().includes(query);
    });
    return truncateJson({
      characters: matches.slice(0, 20).map((item) => ({
        id: item.id,
        name: item.name,
        appearance: item.appearance,
        personality: item.personality,
        assetCount: item.assets.length,
      })),
    });
  }

  private async getCharacter(args: Record<string, unknown>) {
    const characterId = requiredId(args.characterId, 'characterId');
    const character = await this.characters.findById(characterId);
    return truncateJson({
      id: character.id,
      name: character.name,
      appearance: character.appearance,
      personality: character.personality,
      identityPrompt: character.identityPrompt,
      assets: character.assets.slice(0, 16).map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        filename: asset.filename,
        mimeType: asset.mimeType,
      })),
    });
  }

  private async listConversationAssets(
    args: Record<string, unknown>,
    ctx: CreativeToolContext,
  ) {
    if (!ctx.conversationId) {
      throw new BadRequestException('Informe a conversa');
    }
    const kindFilter =
      typeof args.kind === 'string' && args.kind.trim()
        ? args.kind.trim()
        : undefined;
    if (ctx.kind === 'image') {
      const assets = await this.prisma.imageAsset.findMany({
        where: {
          projectId: ctx.conversationId,
          ...(kindFilter ? { kind: kindFilter } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 24,
        select: {
          id: true,
          kind: true,
          filename: true,
          mimeType: true,
          createdAt: true,
        },
      });
      return truncateJson({ assets });
    }
    const assets = await this.prisma.videoAsset.findMany({
      where: {
        projectId: ctx.conversationId,
        ...(kindFilter ? { kind: kindFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        id: true,
        kind: true,
        filename: true,
        mimeType: true,
        createdAt: true,
      },
    });
    return truncateJson({ assets });
  }

  private async listImageLibrary(ctx: CreativeToolContext) {
    if (ctx.kind !== 'video') {
      throw new BadRequestException(
        'list_image_library só existe no chat de vídeo',
      );
    }
    const projects = await this.imageStudio.library();
    return truncateJson({
      conversations: projects.slice(0, 12).map((project) => ({
        id: project.id,
        name: project.name,
        assets: project.assets.slice(0, 6).map((asset) => ({
          id: asset.id,
          filename: asset.filename,
          createdAt: asset.createdAt,
        })),
      })),
    });
  }
}

function proposeImage(args: Record<string, unknown>): ImageGenerationProposal {
  const prompt = requiredText(args.prompt, 'prompt');
  const referenceAssetIds = stringList(args.referenceAssetIds);
  const leadImageIds = stringList(args.leadImageIds);
  return {
    kind: 'image',
    prompt,
    model: optionalString(args.model),
    temperature: optionalNumber(args.temperature),
    aspectRatio: optionalString(args.aspectRatio),
    imageSize: optionalString(args.imageSize),
    systemInstruction: optionalString(args.systemInstruction),
    googleSearch:
      typeof args.googleSearch === 'boolean' ? args.googleSearch : undefined,
    referenceAssetIds,
    leadId: optionalString(args.leadId),
    leadLabel: optionalString(args.leadLabel),
    leadImageIds,
    characterId: optionalString(args.characterId),
    rationale: optionalString(args.rationale),
    estimatedTokens: estimatePromptTokens(
      prompt,
      referenceAssetIds.length + leadImageIds.length,
    ),
  };
}

function proposeVideo(args: Record<string, unknown>): VideoGenerationProposal {
  const prompt = requiredText(args.prompt, 'prompt');
  const leadImageIds = stringList(args.leadImageIds);
  const frameCount = [
    args.firstFrameImageAssetId,
    args.lastFrameImageAssetId,
    args.firstFrameAssetId,
    args.lastFrameAssetId,
    ...leadImageIds,
  ].filter(Boolean).length;
  return {
    kind: 'video',
    prompt,
    model: optionalString(args.model),
    aspectRatio: optionalString(args.aspectRatio),
    duration: optionalString(args.duration),
    resolution: optionalString(args.resolution),
    thinkingLevel: optionalString(args.thinkingLevel),
    firstFrameImageAssetId: optionalString(args.firstFrameImageAssetId),
    lastFrameImageAssetId: optionalString(args.lastFrameImageAssetId),
    firstFrameAssetId: optionalString(args.firstFrameAssetId),
    lastFrameAssetId: optionalString(args.lastFrameAssetId),
    leadId: optionalString(args.leadId),
    leadLabel: optionalString(args.leadLabel),
    leadImageIds,
    characterId: optionalString(args.characterId),
    rationale: optionalString(args.rationale),
    estimatedTokens: estimatePromptTokens(prompt, frameCount),
  };
}

export function isGenerationProposal(
  value: unknown,
): value is GenerationProposal {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  const prompt = (value as { prompt?: unknown }).prompt;
  return (
    (kind === 'image' || kind === 'video') &&
    typeof prompt === 'string' &&
    prompt.trim().length > 0
  );
}

function requiredId(value: unknown, field: string): string {
  const text = String(value || '').trim();
  if (!text) throw new BadRequestException(`Informe ${field}`);
  return text;
}

function requiredText(value: unknown, field: string): string {
  const text = String(value || '').trim();
  if (!text) throw new BadRequestException(`Informe ${field}`);
  return text;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text || undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const item of value) {
    const text = String(item || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    next.push(text);
  }
  return next;
}

export function truncateJson(value: unknown): unknown {
  const raw = JSON.stringify(value);
  if (raw.length <= MAX_TOOL_RESULT_CHARS) return value;
  return {
    truncated: true,
    preview: raw.slice(0, MAX_TOOL_RESULT_CHARS),
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new BadRequestException('Tool excedeu o tempo limite')),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
