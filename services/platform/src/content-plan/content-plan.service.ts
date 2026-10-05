import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { JwtUser } from '../auth/identity';
import { hasStudioPermission, STUDIO_PERMISSION } from '../auth/roles';
import {
  buildBrandIdentityPromptBlock,
  hasUsefulBrandIdentity,
  type BrandIdentity,
} from '../brand-identity/brand-identity.contract';
import { BrandIdentityService } from '../brand-identity/brand-identity.service';
import { CalendarService } from '../calendar/calendar.service';
import { CreativeCharacterService } from '../creative-studio/creative-character.service';
import { CreativeStudioService } from '../creative-studio/creative-studio.service';
import { clampSlideCount } from '../creative-studio/carousel-instagram.planner';
import { ImageStudioService } from '../image-studio/image-studio.service';
import { LeadActivityService } from '../lead-activity/lead-activity.service';
import { LlmService } from '../llm/llm.service';
import { buildLeadBrief } from '../owner/lead-brief';
import type { LeadLike } from '../owner/lead-like';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerWhere } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import { VideoStudioService } from '../video-studio/video-studio.service';
import { runWithAiUsage } from '../ai-usage/ai-usage.context';
import { AI_FEATURES } from '../ai-usage/ai-usage.features';
import { requireTenantId, tenantWhere } from '../tenant/tenant.util';
import {
  applyItemSelection,
  appendVideoTakes,
  buildItemProductionPrompt,
  clampVideoTakeCount,
  linkVideoTakeAsset,
  markItemsSelected,
  parsePlanItems,
  previewMediaFromAssets,
  resolveVideoTakeToGenerate,
  scheduleAssetIds,
  studioSourceForTool,
  toolForFormat,
  type ContentPlanFormBrief,
  type ContentPlanItem,
  type ContentPlanStudioSource,
  type ContentPlanStrategy,
  type ContentPlanTool,
} from './content-plan.contract';
import {
  applyBreakVideoTakes,
  applyItemRewrite,
  buildBreakVideoTakesPrompt,
  buildClientContext,
  buildContentPlanPrompt,
  buildFormBrief,
  buildItemRewritePrompt,
  buildScheduleDates,
  clampPostsPerWeek,
  clampWeeks,
  defaultPlanTitle,
  parseContentPlanSpec,
  parseFormats,
  parseMixMode,
  parseObjectives,
  parseTones,
  resolvePlanStart,
  summarizeIgReport,
  type ContentPlanLeadSlice,
} from './content-plan.planner';
import { GenerateContentPlanDto } from './dto/generate-content-plan.dto';
import { CreateContentPlanItemDto } from './dto/create-content-plan-item.dto';
import { BreakContentPlanTakesDto } from './dto/break-content-plan-takes.dto';
import { RewriteContentPlanItemDto } from './dto/rewrite-content-plan-item.dto';
import { SelectContentPlanItemsDto } from './dto/select-content-plan-items.dto';
import { SelectContentPlanMediaDto } from './dto/select-content-plan-media.dto';
import { estimateProduce, type ProduceEstimateQuery } from './content-plan.estimate';
import {
  applyVideoHookToPrompt,
  findVideoHook,
  type ContentPlanVideoHook,
} from './video-hooks';
import {
  CONTENT_PLAN_STATUS,
  publicContentPlan,
  type ContentPlanReason,
} from './content-plan.public';

@Injectable()
export class ContentPlanService {
  private readonly logger = new Logger(ContentPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudioLeadAccessService,
    private readonly llm: LlmService,
    private readonly activity: LeadActivityService,
    private readonly owners: OwnerLookup,
    private readonly creativeStudio: CreativeStudioService,
    private readonly imageStudio: ImageStudioService,
    private readonly videoStudio: VideoStudioService,
    private readonly characters: CreativeCharacterService,
    private readonly calendar: CalendarService,
    private readonly brandIdentity: BrandIdentityService,
  ) {}

  async open(user: JwtUser, leadId?: string, customerId?: string) {
    const owner = await this.requireOwner(user, leadId, customerId);
    const gate = await this.gate(owner.ownerId);
    if (!gate.ready || !gate.report || !gate.igJob) {
      return { ready: false as const, reason: gate.reason, plans: [] };
    }
    const rows = await this.prisma.contentPlan.findMany({
      where: tenantWhere(ownerWhere(owner.ownerId)),
      orderBy: { updatedAt: 'desc' },
    });
    const draftRow =
      rows.find((row) => row.status === CONTENT_PLAN_STATUS.DRAFT) || null;
    const confirmed = rows.filter(
      (row) => row.status === CONTENT_PLAN_STATUS.CONFIRMED,
    );
    const plans = [...(draftRow ? [draftRow] : []), ...confirmed];
    const lead = await this.leadSlice(owner.ownerId);
    const context = buildClientContext({
      igJobId: gate.igJob.id,
      analyzedAt: gate.analyzedAt,
      report: gate.report,
      lead,
    });
    const previous = confirmed[0]
      ? {
          id: confirmed[0].id,
          title: confirmed[0].title,
          createdAt: confirmed[0].createdAt,
        }
      : null;
    return {
      ready: true as const,
      igJobId: gate.igJobId,
      context,
      previousPlan: previous,
      draft: draftRow ? publicContentPlan(draftRow) : null,
      plans: plans.map(publicContentPlan),
    };
  }

  async generate(dto: GenerateContentPlanDto, user: JwtUser) {
    const owner = await this.requireOwner(user, dto.leadId, dto.customerId);
    const gate = await this.gate(owner.ownerId);
    if (!gate.ready || !gate.igJob || !gate.report) {
      throw new BadRequestException(this.gateMessage(gate.reason));
    }
    const formats = parseFormats(dto.formats);
    if (!formats.length) {
      throw new BadRequestException('Escolha ao menos um tipo de post');
    }
    const objectives = parseObjectives(dto.objectives);
    if (!objectives.length) {
      throw new BadRequestException('Escolha até três objetivos');
    }
    const title = dto.title?.trim() || defaultPlanTitle(objectives);
    const postsPerWeek = clampPostsPerWeek(dto.postsPerWeek);
    const weeks = clampWeeks(dto.weeks);
    const formatMix = parseMixMode(dto.formatMix);
    const tones = parseTones(dto.tones);
    const promote = dto.promote?.trim() || '';
    const avoid = dto.avoid?.trim() || '';
    const goalNote = dto.goalNote?.trim() || '';
    const overrides = {
      segment: dto.contextOverrides?.segment?.trim() || '',
      audience: dto.contextOverrides?.audience?.trim() || '',
      voice: dto.contextOverrides?.voice?.trim() || '',
    };
    const start = resolvePlanStart(dto.startsOn);
    const dates = buildScheduleDates(postsPerWeek, weeks, start).map((date) =>
      date.toISOString(),
    );
    const description = [promote && `Promover: ${promote}`, avoid && `Evitar: ${avoid}`]
      .filter(Boolean)
      .join('\n');
    const previous = await this.loadPrevious(
      owner.ownerId,
      Boolean(dto.usePreviousPlan),
      dto.referencePlanId,
    );
    const lead = await this.leadSlice(owner.ownerId);
    const formBrief: ContentPlanFormBrief = buildFormBrief({
      title,
      objectives,
      goalNote,
      tones,
      promote,
      avoid,
      formatMix,
      startsOn: dto.startsOn?.trim() || start.toISOString().slice(0, 10),
      overrides,
      usePreviousPlan: Boolean(previous),
    });
    const context = {
      title,
      description,
      postsPerWeek,
      weeks,
      formats,
      formatMix,
      dates,
      report: gate.report,
      lead,
      objectives,
      goalNote,
      tones,
      promote,
      avoid,
      overrides,
      previousPlan: previous
        ? { title: previous.title, strategy: previous.strategy }
        : null,
    };
    let spec: ReturnType<typeof parseContentPlanSpec>;
    const jobId = `content-plan:${owner.ownerId}:${Date.now()}`;
    try {
      spec = await runWithAiUsage(
        {
          feature: AI_FEATURES.contentPlan,
          userId: user.id,
          leadId: owner.leadId,
          customerId: owner.customerId,
          jobId,
        },
        () =>
          this.llm.generateJson(
            buildContentPlanPrompt(context),
            (value) => parseContentPlanSpec(value, context),
            {
              role: 'plan',
              temperature: 0.2,
              expectedShape: 'ContentPlanSpec',
            },
          ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar o plano';
      throw new BadGatewayException(message);
    }
    await this.prisma.contentPlan.deleteMany({
      where: tenantWhere({
        status: CONTENT_PLAN_STATUS.DRAFT,
        ...ownerWhere(owner.ownerId),
      }),
    });
    const row = await this.prisma.contentPlan.create({
      data: {
        tenantId: requireTenantId(),
        leadId: owner.leadId,
        customerId: owner.customerId,
        title,
        description,
        postsPerWeek,
        weeks,
        formats,
        items: spec.items,
        strategy: spec.strategy as object,
        brief: formBrief as object,
        status: CONTENT_PLAN_STATUS.DRAFT,
        sourceIgJobId: gate.igJob.id,
        referencePlanId: previous?.id || null,
        createdByUserId: user.id,
      },
    });
    await this.prisma.aiUsageEvent.updateMany({
      where: { jobId },
      data: { jobId: row.id },
    });
    return publicContentPlan(row);
  }

  async confirm(id: string, user: JwtUser) {
    const row = await this.requirePlan(id);
    const ownerId = row.leadId || row.customerId;
    if (!ownerId) throw new BadRequestException('Plano sem perfil');
    await this.access.assertCanAccess(user, ownerId);
    if (row.status !== CONTENT_PLAN_STATUS.DRAFT) {
      throw new BadRequestException('Só dá para confirmar um rascunho');
    }
    const items = markItemsSelected(parsePlanItems(row.items));
    const confirmed = await this.prisma.contentPlan.update({
      where: { id: row.id },
      data: { status: CONTENT_PLAN_STATUS.CONFIRMED, items: items as object[] },
    });
    await this.trace(ownerId, {
      title: 'Plano de conteúdo confirmado',
      summary: `${confirmed.title} · ${confirmed.postsPerWeek} posts/semana`,
      payload: { planId: confirmed.id, status: 'confirmed' },
    });
    return publicContentPlan(confirmed);
  }

  async discard(id: string, user: JwtUser) {
    const row = await this.requirePlan(id);
    const ownerId = row.leadId || row.customerId;
    if (!ownerId) throw new BadRequestException('Plano sem perfil');
    await this.access.assertCanAccess(user, ownerId);
    if (row.status !== CONTENT_PLAN_STATUS.DRAFT) {
      throw new BadRequestException('Só dá para descartar um rascunho');
    }
    await this.prisma.contentPlan.delete({ where: { id: row.id } });
    return { ok: true };
  }

  estimate(query: ProduceEstimateQuery) {
    return estimateProduce({
      ...query,
      planModel: String(query.planModel || '').trim() || this.llm.modelFor('plan'),
    });
  }

  async selectItems(id: string, dto: SelectContentPlanItemsDto, user: JwtUser) {
    const row = await this.requireConfirmedPlan(id, user);
    const current = parsePlanItems(row.items);
    const items = applyItemSelection(current, dto.keepIds);
    if (!items.some((item) => item.status !== 'dropped')) {
      throw new BadRequestException('Escolha ao menos uma peça');
    }
    return this.saveItems(row.id, items);
  }

  async rewriteItem(
    id: string,
    itemId: string,
    dto: RewriteContentPlanItemDto,
    user: JwtUser,
  ) {
    const row = await this.requireConfirmedPlan(id, user);
    const items = parsePlanItems(row.items);
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) throw new NotFoundException('Peça não encontrada');
    const current = items[index];
    if (current.status === 'dropped') {
      throw new BadRequestException('Esta peça saiu do plano');
    }
    if (current.status === 'scheduled') {
      throw new BadRequestException('Esta peça já está na agenda');
    }
    const note = String(dto.note || '').trim();
    if (note.length < 3) {
      throw new BadRequestException('Diga o que mudar no roteiro');
    }
    const videoHook = this.requireVideoHook(
      dto.videoHookId !== undefined ? dto.videoHookId : current.videoHookId,
    );
    const ownerId = row.leadId || row.customerId;
    const jobId = `content-plan-rewrite:${row.id}:${current.id}`;
    try {
      const rewritten = await runWithAiUsage(
        {
          feature: AI_FEATURES.contentPlan,
          userId: user.id,
          leadId: row.leadId,
          customerId: row.customerId,
          jobId,
        },
        () =>
          this.llm.generateJson(
            buildItemRewritePrompt(current, note, videoHook),
            (value) => applyItemRewrite(current, value),
            {
              role: 'plan',
              temperature: 0.35,
              model: dto.planModel?.trim() || undefined,
              expectedShape: 'ContentPlanItemRewrite',
            },
          ),
      );
      const rest = { ...rewritten };
      delete rest.videoHookId;
      items[index] = {
        ...rest,
        ...(videoHook ? { videoHookId: videoHook.id } : {}),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao reescrever o roteiro';
      throw new BadGatewayException(message);
    }
    const saved = await this.saveItems(row.id, items);
    if (ownerId) {
      await this.trace(ownerId, {
        title: 'Roteiro da peça reescrito',
        summary: (items[index].title || current.title).slice(0, 120),
        payload: { planId: row.id, itemId: current.id },
      });
    }
    return saved;
  }

  async createItem(
    id: string,
    itemId: string,
    user: JwtUser,
    dto: CreateContentPlanItemDto = {},
  ) {
    const row = await this.requireConfirmedPlan(id, user);
    const items = parsePlanItems(row.items);
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) throw new NotFoundException('Peça não encontrada');
    const current = items[index];
    if (current.status === 'dropped') {
      throw new BadRequestException('Esta peça saiu do plano');
    }
    if (current.status === 'scheduled') {
      throw new BadRequestException('Esta peça já está na agenda');
    }
    const tool = current.tool || toolForFormat(current.format);
    this.assertToolPermission(user, tool);
    const plannedTake =
      tool === 'video'
        ? resolveVideoTakeToGenerate(current, dto.takeId)
        : undefined;
    if (tool === 'video' && dto.takeId && !plannedTake) {
      throw new BadRequestException('Take inválida para esta peça');
    }
    const prompt = plannedTake
      ? plannedTake.productionPrompt
      : buildItemProductionPrompt(current);
    if (!prompt.trim()) {
      throw new BadRequestException('A peça está sem briefing');
    }
    const ownerId = row.leadId || row.customerId || '';
    const generated = await this.generateItemMedia(
      current,
      tool,
      prompt,
      user,
      dto,
      ownerId,
    );
    const characterId =
      tool === 'video' ? String(dto.characterId || '').trim() : '';
    const characterAssetId = characterId
      ? String(dto.characterAssetId || '').trim()
      : '';
    const videoHook =
      tool === 'video'
        ? this.requireVideoHook(
            dto.videoHookId !== undefined ? dto.videoHookId : current.videoHookId,
          )
        : undefined;
    const media =
      tool === 'video'
        ? appendVideoTakes(current, generated)
        : {
            studioAssetIds: generated.studioAssetIds,
            previewUrls: generated.previewUrls,
            selectedStudioAssetId: generated.studioAssetIds[0] || '',
          };
    const videoTakes =
      plannedTake && media.selectedStudioAssetId
        ? linkVideoTakeAsset(
            current.videoTakes,
            plannedTake.id,
            media.selectedStudioAssetId,
          )
        : current.videoTakes;
    const rest = { ...current };
    delete rest.characterId;
    delete rest.characterAssetId;
    delete rest.videoHookId;
    delete rest.selectedStudioAssetId;
    delete rest.videoTakes;
    const next: ContentPlanItem = {
      ...rest,
      tool,
      studioSource: generated.studioSource,
      studioProjectId: generated.studioProjectId,
      studioAssetIds: media.studioAssetIds,
      previewUrls: media.previewUrls,
      status: 'created',
      ...(media.selectedStudioAssetId
        ? { selectedStudioAssetId: media.selectedStudioAssetId }
        : {}),
      ...(videoTakes?.length ? { videoTakes } : {}),
      ...(characterId ? { characterId } : {}),
      ...(characterAssetId ? { characterAssetId } : {}),
      ...(videoHook ? { videoHookId: videoHook.id } : {}),
    };
    items[index] = next;
    return this.saveItems(row.id, items);
  }

  async breakItemTakes(
    id: string,
    itemId: string,
    dto: BreakContentPlanTakesDto,
    user: JwtUser,
  ) {
    const row = await this.requireConfirmedPlan(id, user);
    const items = parsePlanItems(row.items);
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) throw new NotFoundException('Peça não encontrada');
    const current = items[index];
    if (current.status === 'dropped') {
      throw new BadRequestException('Esta peça saiu do plano');
    }
    if (current.status === 'scheduled') {
      throw new BadRequestException('Peça já está na agenda');
    }
    const tool = current.tool || toolForFormat(current.format);
    if (tool !== 'video' || current.format !== 'reel') {
      throw new BadRequestException('Só reel pode ser quebrado em takes');
    }
    this.assertToolPermission(user, tool);
    const takeCount = clampVideoTakeCount(dto.takeCount);
    const videoHook = this.requireVideoHook(
      dto.videoHookId !== undefined ? dto.videoHookId : current.videoHookId,
    );
    const jobId = `content-plan-break:${row.id}:${current.id}`;
    try {
      const broken = await runWithAiUsage(
        {
          feature: AI_FEATURES.contentPlan,
          userId: user.id,
          leadId: row.leadId,
          customerId: row.customerId,
          jobId,
        },
        () =>
          this.llm.generateJson(
            buildBreakVideoTakesPrompt(current, takeCount, videoHook),
            (value) => applyBreakVideoTakes(current, value, takeCount),
            {
              role: 'plan',
              temperature: 0.4,
              model: dto.planModel?.trim() || undefined,
              expectedShape: 'ContentPlanVideoTakes',
            },
          ),
      );
      if (!(broken.videoTakes || []).length) {
        throw new BadGatewayException('A IA não partiu o roteiro em takes');
      }
      const rest = { ...broken };
      delete rest.videoHookId;
      items[index] = {
        ...rest,
        ...(videoHook ? { videoHookId: videoHook.id } : {}),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Não partiu o roteiro';
      this.logger.warn(`break takes failed plan=${row.id} item=${itemId}: ${message}`);
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException(message);
    }
    return this.saveItems(row.id, items);
  }

  async selectItemMedia(
    id: string,
    itemId: string,
    dto: SelectContentPlanMediaDto,
    user: JwtUser,
  ) {
    const row = await this.requireConfirmedPlan(id, user);
    const items = parsePlanItems(row.items);
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) throw new NotFoundException('Peça não encontrada');
    const current = items[index];
    if (current.status === 'dropped') {
      throw new BadRequestException('Esta peça saiu do plano');
    }
    if (current.status === 'scheduled') {
      throw new BadRequestException('Peça já está na agenda');
    }
    if (current.status !== 'created') {
      throw new BadRequestException('Crie o conteúdo antes de escolher a mídia');
    }
    const selected = String(dto.selectedStudioAssetId || '').trim();
    const ids = current.studioAssetIds || [];
    if (!selected || !ids.includes(selected)) {
      throw new BadRequestException('Mídia inválida para esta peça');
    }
    items[index] = {
      ...current,
      selectedStudioAssetId: selected,
    };
    return this.saveItems(row.id, items);
  }

  async scheduleItem(id: string, itemId: string, user: JwtUser) {
    const row = await this.requireConfirmedPlan(id, user);
    const items = parsePlanItems(row.items);
    const index = items.findIndex((item) => item.id === itemId);
    if (index < 0) throw new NotFoundException('Peça não encontrada');
    const current = items[index];
    if (current.status === 'dropped') {
      throw new BadRequestException('Esta peça saiu do plano');
    }
    if (current.status === 'scheduled' && current.calendarPostId) {
      return publicContentPlan(row);
    }
    const assetIds = scheduleAssetIds(current);
    const source = current.studioSource;
    if (!assetIds.length || !source) {
      throw new BadRequestException('Crie o conteúdo antes de agendar');
    }
    const post = await this.calendar.create(
      {
        title: (current.title || 'Peça do plano').slice(0, 200),
        caption: (current.caption || '').slice(0, 2200),
        scheduledAt: current.scheduledAt,
        platforms: ['instagram'],
        leadId: row.leadId || undefined,
        customerId: row.customerId || undefined,
      },
      user.id,
    );
    for (const assetId of assetIds) {
      await this.calendar.attachStudioAsset(post.id, {
        source,
        assetId,
      });
    }
    await this.calendar.schedule(post.id);
    items[index] = {
      ...current,
      status: 'scheduled',
      calendarPostId: post.id,
    };
    return this.saveItems(row.id, items);
  }

  private async requireConfirmedPlan(id: string, user: JwtUser) {
    const row = await this.requirePlan(id);
    const ownerId = row.leadId || row.customerId;
    if (!ownerId) throw new BadRequestException('Plano sem perfil');
    await this.access.assertCanAccess(user, ownerId);
    if (row.status !== CONTENT_PLAN_STATUS.CONFIRMED) {
      throw new BadRequestException('Confirme o plano antes de produzir');
    }
    return row;
  }

  private async saveItems(id: string, items: ContentPlanItem[]) {
    const updated = await this.prisma.contentPlan.update({
      where: { id },
      data: { items: items as object[] },
    });
    return publicContentPlan(updated);
  }

  private assertToolPermission(user: JwtUser, tool: ContentPlanTool) {
    if (tool === 'video') {
      if (!hasStudioPermission(user, STUDIO_PERMISSION.VIDEOS)) {
        throw new ForbiddenException('Sem permissão para gerar vídeos');
      }
      return;
    }
    if (!hasStudioPermission(user, STUDIO_PERMISSION.IMAGES)) {
      throw new ForbiddenException('Sem permissão para gerar imagens');
    }
  }

  private async generateItemMedia(
    item: ContentPlanItem,
    tool: ContentPlanTool,
    prompt: string,
    user: JwtUser,
    dto: CreateContentPlanItemDto = {},
    ownerId = '',
  ): Promise<{
    studioSource: ContentPlanStudioSource;
    studioProjectId: string;
    studioAssetIds: string[];
    previewUrls: string[];
  }> {
    const brand = await this.resolveProduceBrand(ownerId, dto);
    const productionPrompt = brand.promptBlock
      ? `${prompt}\n\n${brand.promptBlock}`
      : prompt;
    const studioSource = studioSourceForTool(tool);
    if (tool === 'carousel') {
      const generated = await this.creativeStudio.generateCarousel(
        {
          prompt: productionPrompt,
          notes: item.visualDirection,
          slideCount: clampSlideCount(dto.slides || item.structure?.length || undefined),
          planModel: dto.planModel,
          model: dto.imageModel,
          imageSize: dto.imageSize,
          ...(brand.logoFile ? { brandReferences: [brand.logoFile] } : {}),
        },
        user,
      );
      const projectId = String(generated.projectId || '');
      const media = previewMediaFromAssets(generated.assets || []);
      if (!projectId || !media.studioAssetIds.length) {
        throw new BadGatewayException(generated.error || 'A skill não gerou os slides');
      }
      return {
        studioSource,
        studioProjectId: projectId,
        ...media,
      };
    }
    if (tool === 'image') {
      const project = await this.imageStudio.create(
        {
          name: `Plano · ${(item.title || 'Estático').slice(0, 60)}`,
          aspectRatio: '4:5',
          model: dto.imageModel,
          imageSize: dto.imageSize,
        },
        user.id,
      );
      let referenceAssetIds: string[] = [];
      if (brand.logoFile) {
        const created = await this.imageStudio.addReferences(project.id, [
          brand.logoFile,
        ]);
        referenceAssetIds = created.map((asset) => asset.id).filter(Boolean);
      }
      const generated = await this.imageStudio.generate(project.id, {
        prompt: productionPrompt,
        aspectRatio: '4:5',
        model: dto.imageModel,
        imageSize: dto.imageSize,
        ...(referenceAssetIds.length ? { referenceAssetIds } : {}),
      });
      const media = previewMediaFromAssets(generated.assets || []);
      if (!media.studioAssetIds.length) {
        throw new BadGatewayException('Não gerou a imagem');
      }
      return {
        studioSource,
        studioProjectId: project.id,
        ...media,
      };
    }
    const reuseProjectId =
      item.studioSource === 'video-studio' && item.studioProjectId
        ? item.studioProjectId
        : '';
    const project = reuseProjectId
      ? { id: reuseProjectId }
      : await this.videoStudio.create(
          { name: `Plano · ${(item.title || 'Reel').slice(0, 60)}` },
          user.id,
        );
    const attached = await this.attachCharacterToVideo(
      project.id,
      dto.characterId,
      dto.characterAssetId,
      productionPrompt,
    );
    let videoPrompt = attached.prompt;
    let firstFrameAssetId = attached.firstFrameAssetId;
    if (brand.logoFile && !firstFrameAssetId) {
      const frames = await this.videoStudio.addFrames(project.id, 'first-frame', [
        brand.logoFile,
      ]);
      firstFrameAssetId = frames[0]?.id;
    }
    const videoHook = this.requireVideoHook(
      dto.videoHookId !== undefined ? dto.videoHookId : item.videoHookId,
    );
    const generated = await this.videoStudio.generate(project.id, {
      prompt: applyVideoHookToPrompt(videoPrompt, videoHook),
      aspectRatio: '9:16',
      model: dto.videoModel,
      duration: dto.duration,
      resolution: dto.resolution,
      ...(firstFrameAssetId ? { firstFrameAssetId } : {}),
    });
    const media = previewMediaFromAssets(generated.assets || []);
    if (!media.studioAssetIds.length) {
      throw new BadGatewayException('Não gerou o vídeo');
    }
    return {
      studioSource,
      studioProjectId: project.id,
      ...media,
    };
  }

  private async resolveProduceBrand(
    ownerId: string,
    dto: CreateContentPlanItemDto,
  ): Promise<{
    identity: BrandIdentity;
    promptBlock: string;
    logoFile: Awaited<ReturnType<BrandIdentityService['resolveLogoFile']>>;
  }> {
    const empty = {
      identity: {} as BrandIdentity,
      promptBlock: '',
      logoFile: null as Awaited<
        ReturnType<BrandIdentityService['resolveLogoFile']>
      >,
    };
    if (!ownerId) return empty;
    const useBrandIdentity = dto.useBrandIdentity === true;
    const useBrandLogo = dto.useBrandLogo === true;
    if (!useBrandIdentity && !useBrandLogo) return empty;
    let identity: BrandIdentity = {};
    try {
      identity = await this.brandIdentity.get(ownerId);
    } catch {
      identity = {};
    }
    if (useBrandLogo && !identity.logoImageId) {
      throw new BadRequestException(
        'Configure o logo na Identidade da marca antes de usar o logo',
      );
    }
    if (useBrandLogo) {
      const appearance = String(dto.logoAppearance || '').trim();
      if (!appearance) {
        throw new BadRequestException(
          'Descreva como o logo aparece quando Usar logo está ligado',
        );
      }
    }
    const promptBlock = buildBrandIdentityPromptBlock(identity, {
      useBrandIdentity:
        useBrandIdentity && hasUsefulBrandIdentity(identity),
      useBrandLogo,
      logoAppearance: dto.logoAppearance,
    });
    const logoFile = useBrandLogo
      ? await this.brandIdentity.resolveLogoFile(ownerId, identity.logoImageId)
      : null;
    if (useBrandLogo && !logoFile) {
      throw new BadRequestException('Não foi possível carregar o logo da marca');
    }
    return { identity, promptBlock, logoFile };
  }

  private requireVideoHook(
    value: string | null | undefined,
  ): ContentPlanVideoHook | undefined {
    const id = String(value || '').trim();
    if (!id) return undefined;
    const hook = findVideoHook(id);
    if (!hook) {
      throw new BadRequestException('Hook visual inválido');
    }
    return hook;
  }

  private async attachCharacterToVideo(
    projectId: string,
    characterId: string | undefined,
    characterAssetId: string | undefined,
    prompt: string,
  ): Promise<{ prompt: string; firstFrameAssetId?: string }> {
    const id = String(characterId || '').trim();
    if (!id) return { prompt };
    const assetId = String(characterAssetId || '').trim() || undefined;
    const { character, file } = await this.characters.heroImageFile(id, assetId);
    if (!file) {
      throw new BadRequestException(
        'Gere uma foto do personagem em Personagens antes de usar no vídeo',
      );
    }
    const created = await this.videoStudio.addFrames(projectId, 'first-frame', [
      file,
    ]);
    const identity = character.identityPrompt?.trim();
    return {
      prompt: identity ? `${prompt}\n\n${identity}` : prompt,
      firstFrameAssetId: created[0]?.id,
    };
  }

  private async gate(ownerId: string): Promise<{
    ready: boolean;
    reason?: ContentPlanReason;
    igJobId?: string;
    igJob?: { id: string };
    analyzedAt?: Date;
    report?: ReturnType<typeof summarizeIgReport>;
  }> {
    const conn = await this.prisma.instagramConnection.findFirst({
      where: ownerWhere(ownerId),
    });
    if (!conn) {
      return { ready: false, reason: 'instagram_disconnected' };
    }
    const igJob = await this.prisma.instagramSkillJob.findFirst({
      where: tenantWhere({
        status: 'done',
        ...ownerWhere(ownerId),
      }),
      orderBy: { createdAt: 'desc' },
    });
    const report = summarizeIgReport(igJob?.report);
    if (!igJob || !report) {
      return { ready: false, reason: 'ig_skill_required' };
    }
    return {
      ready: true,
      igJobId: igJob.id,
      igJob: { id: igJob.id },
      analyzedAt: igJob.createdAt,
      report,
    };
  }

  private gateMessage(reason?: ContentPlanReason): string {
    if (reason === 'instagram_disconnected') {
      return 'Conecte o Instagram deste perfil.';
    }
    return 'Rode a Skill Instagram e espere o relatório.';
  }

  private async leadSlice(ownerId: string): Promise<ContentPlanLeadSlice> {
    try {
      const detail = (await this.owners.requireDetail(ownerId)) as LeadLike;
      const brief = buildLeadBrief(detail);
      return {
        name: brief.name,
        category: brief.category,
        city: brief.city,
        services: brief.services || [],
      };
    } catch {
      return { name: '', category: null, city: null, services: [] };
    }
  }

  private async loadPrevious(
    ownerId: string,
    usePrevious: boolean,
    referencePlanId?: string,
  ): Promise<{
    id: string;
    title: string;
    strategy: ContentPlanStrategy | null;
  } | null> {
    if (!usePrevious && !referencePlanId?.trim()) return null;
    const id = referencePlanId?.trim();
    const row = id
      ? await this.prisma.contentPlan.findFirst({
          where: tenantWhere({
            id,
            status: CONTENT_PLAN_STATUS.CONFIRMED,
            ...ownerWhere(ownerId),
          }),
        })
      : await this.prisma.contentPlan.findFirst({
          where: tenantWhere({
            status: CONTENT_PLAN_STATUS.CONFIRMED,
            ...ownerWhere(ownerId),
          }),
          orderBy: { updatedAt: 'desc' },
        });
    if (!row) return null;
    const strategy =
      row.strategy && typeof row.strategy === 'object' && !Array.isArray(row.strategy)
        ? (row.strategy as ContentPlanStrategy)
        : null;
    return { id: row.id, title: row.title, strategy };
  }

  private async requireOwner(
    user: JwtUser,
    leadId?: string,
    customerId?: string,
  ): Promise<{
    ownerId: string;
    leadId: string | null;
    customerId: string | null;
  }> {
    const lead = leadId?.trim() || '';
    const customer = customerId?.trim() || '';
    if ((lead && customer) || (!lead && !customer)) {
      throw new BadRequestException('Informe leadId ou customerId');
    }
    const ownerId = lead || customer;
    await this.access.assertCanAccess(user, ownerId);
    return {
      ownerId,
      leadId: lead || null,
      customerId: customer || null,
    };
  }

  private async requirePlan(id: string) {
    const row = await this.prisma.contentPlan.findFirst({
      where: tenantWhere({ id }),
    });
    if (!row) throw new NotFoundException('Plano não encontrado');
    return row;
  }

  private async trace(
    ownerId: string,
    input: {
      title: string;
      summary: string;
      payload: Record<string, unknown>;
    },
  ) {
    try {
      await this.activity.record({
        leadId: ownerId,
        channel: 'skill',
        kind: 'skill.content-plan',
        title: input.title,
        summary: input.summary,
        payload: input.payload,
      });
    } catch (error) {
      this.logger.warn(
        error instanceof Error
          ? error.message
          : 'Falha ao gravar histórico do plano',
      );
    }
  }
}
