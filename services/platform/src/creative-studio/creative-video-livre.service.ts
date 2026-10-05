import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { runWithAiUsage } from '../ai-usage/ai-usage.context';
import { AI_FEATURES } from '../ai-usage/ai-usage.features';
import {
  applyVideoHookToPrompt,
  findVideoHook,
  listVideoHooks,
  type ContentPlanVideoHook,
} from '../content-plan/video-hooks';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertSameTenant,
  requireTenantId,
  tenantWhere,
} from '../tenant/tenant.util';
import { VideoStudioService } from '../video-studio/video-studio.service';
import { mergeVideoProjectSettings } from '../video-studio/video-models';
import { isGeneratingLocked } from './clip-runtime';
import { CreativeCharacterService } from './creative-character.service';
import type {
  BreakVideoLivreDto,
  CreateVideoLivreClipDto,
  GenerateVideoLivreClipDto,
  RefineVideoLivreDto,
} from './dto/video-livre.dto';
import {
  VIDEO_LIVRE_CLIP_STATUS,
  applyNoCharacterVoice,
  buildVideoLivreBreakPrompt,
  buildVideoLivreRefinePrompt,
  clampVideoTakeCount,
  parseVideoLivreBreak,
  parseVideoLivreRefine,
} from './video-livre.planner';

const clipInclude = {
  character: {
    include: {
      assets: { orderBy: { createdAt: 'asc' as const } },
    },
  },
};

@Injectable()
export class CreativeVideoLivreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly videoStudio: VideoStudioService,
    private readonly characters: CreativeCharacterService,
  ) {}

  listHooks() {
    return listVideoHooks();
  }

  async findAll() {
    return this.prisma.creativeVideoLivreClip.findMany({
      where: tenantWhere(),
      orderBy: { updatedAt: 'desc' },
      include: clipInclude,
    });
  }

  async findById(id: string) {
    const clip = await this.prisma.creativeVideoLivreClip.findUnique({
      where: { id },
      include: clipInclude,
    });
    if (!clip) {
      throw new NotFoundException(`Clipe ${id} não encontrado`);
    }
    return assertSameTenant(clip, `Clipe ${id} não encontrado`);
  }

  async refine(dto: RefineVideoLivreDto, userId?: string) {
    const brief = String(dto.brief || '').trim();
    if (brief.length < 3) {
      throw new BadRequestException('Informe um briefing');
    }
    const hook = this.requireVideoHook(dto.videoHookId);
    const note = String(dto.note || '').trim();
    try {
      return await runWithAiUsage(
        {
          feature: AI_FEATURES.videoLivre,
          userId: userId || null,
          jobId: `video-livre-refine:${Date.now()}`,
        },
        () =>
          this.llm.generateJson(
            buildVideoLivreRefinePrompt({
              brief,
              note,
              videoHookTitle: hook?.title,
              noCharacterVoice: dto.noCharacterVoice === true,
            }),
            parseVideoLivreRefine,
            {
              role: 'plan',
              temperature: 0.35,
              model: dto.planModel?.trim() || undefined,
              expectedShape: 'VideoLivreRefine',
            },
          ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao aprimorar o roteiro';
      throw new BadGatewayException(message);
    }
  }

  async breakTakes(dto: BreakVideoLivreDto, userId?: string) {
    const script = String(dto.script || '').trim();
    if (script.length < 3) {
      throw new BadRequestException('Informe o roteiro para partir');
    }
    const takeCount = clampVideoTakeCount(dto.takeCount);
    const hook = this.requireVideoHook(dto.videoHookId);
    try {
      const result = await runWithAiUsage(
        {
          feature: AI_FEATURES.videoLivre,
          userId: userId || null,
          jobId: `video-livre-break:${Date.now()}`,
        },
        () =>
          this.llm.generateJson(
            buildVideoLivreBreakPrompt({
              script,
              takeCount,
              videoHookTitle: hook?.title,
              noCharacterVoice: dto.noCharacterVoice === true,
            }),
            (value) => parseVideoLivreBreak(value, takeCount),
            {
              role: 'plan',
              temperature: 0.4,
              model: dto.planModel?.trim() || undefined,
              expectedShape: 'VideoLivreBreakTakes',
            },
          ),
      );
      if (!(result.takes || []).some((take) => take.productionPrompt)) {
        throw new BadGatewayException('A IA não partiu o roteiro em takes');
      }
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao partir o roteiro';
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException(message);
    }
  }

  async create(dto: CreateVideoLivreClipDto, userId?: string) {
    const settings = mergeVideoProjectSettings(dto || {});
    const characterId = String(dto.characterId || '').trim() || null;
    if (characterId) {
      await this.characters.heroImageFile(
        characterId,
        String(dto.characterAssetId || '').trim() || undefined,
      );
    }
    const hook = this.requireVideoHook(dto.videoHookId);
    const prompt = String(dto.prompt || '').trim();
    if (!prompt) {
      throw new BadRequestException('Informe o prompt de produção');
    }
    const clip = await this.prisma.creativeVideoLivreClip.create({
      data: {
        tenantId: requireTenantId(),
        title: String(dto.title || '').trim().slice(0, 120),
        brief: String(dto.brief || '').trim().slice(0, 4000),
        prompt,
        characterId,
        characterAssetId: String(dto.characterAssetId || '').trim(),
        videoHookId: hook?.id || '',
        duration: settings.duration,
        aspectRatio: settings.aspectRatio || '9:16',
        resolution: settings.resolution,
        model: settings.model || '',
        status: VIDEO_LIVRE_CLIP_STATUS.DRAFT,
        createdByUserId: userId || null,
      },
    });
    return this.generate(clip.id, dto, userId);
  }

  async deleteById(id: string) {
    const clip = await this.findById(id);
    if (isGeneratingLocked(clip.status, clip.updatedAt)) {
      throw new ConflictException('Aguarde o clipe terminar de gerar');
    }
    await this.prisma.creativeVideoLivreClip.delete({ where: { id } });
    return { id, deleted: true };
  }

  async generate(
    id: string,
    dto: GenerateVideoLivreClipDto = {},
    userId?: string,
  ) {
    const clip = await this.findById(id);
    if (isGeneratingLocked(clip.status, clip.updatedAt)) {
      throw new ConflictException('Este clipe já está gerando');
    }

    const characterId =
      dto.characterId !== undefined
        ? String(dto.characterId || '').trim() || null
        : clip.characterId;
    const characterAssetId =
      dto.characterAssetId !== undefined
        ? String(dto.characterAssetId || '').trim()
        : clip.characterAssetId;
    const hook = this.requireVideoHook(
      dto.videoHookId !== undefined ? dto.videoHookId : clip.videoHookId,
    );
    const nextPrompt =
      dto.prompt !== undefined ? String(dto.prompt || '').trim() : clip.prompt;
    if (!nextPrompt) {
      throw new BadRequestException('Informe o prompt de produção');
    }
    const settings = mergeVideoProjectSettings(
      {
        aspectRatio: clip.aspectRatio || '9:16',
        duration: clip.duration,
        resolution: clip.resolution,
        model: clip.model || undefined,
      },
      dto,
    );

    await this.prisma.creativeVideoLivreClip.update({
      where: { id },
      data: {
        title:
          dto.title !== undefined
            ? String(dto.title || '').trim().slice(0, 120)
            : clip.title,
        brief:
          dto.brief !== undefined
            ? String(dto.brief || '').trim().slice(0, 4000)
            : clip.brief,
        prompt: nextPrompt,
        characterId,
        characterAssetId,
        videoHookId: hook?.id || '',
        duration: settings.duration,
        aspectRatio: settings.aspectRatio || '9:16',
        resolution: settings.resolution,
        model: settings.model || '',
        status: VIDEO_LIVRE_CLIP_STATUS.GENERATING,
        error: '',
      },
    });

    try {
      const actorId = userId || clip.createdByUserId || '';
      const project = clip.videoProjectId
        ? { id: clip.videoProjectId }
        : await this.videoStudio.create(
            {
              name: `Vídeo livre · ${(clip.title || nextPrompt).slice(0, 60)}`,
            },
            actorId || undefined,
          );

      const attached = await this.attachCharacter(
        project.id,
        characterId || undefined,
        characterAssetId || undefined,
        applyNoCharacterVoice(nextPrompt, dto.noCharacterVoice === true),
      );
      const generated = await this.videoStudio.generate(project.id, {
        prompt: applyVideoHookToPrompt(attached.prompt, hook),
        aspectRatio: settings.aspectRatio || '9:16',
        model: settings.model,
        duration: settings.duration,
        resolution: settings.resolution,
        ...(attached.firstFrameAssetId
          ? { firstFrameAssetId: attached.firstFrameAssetId }
          : {}),
      });
      const asset = (generated.assets || []).find(
        (item: { kind?: string; localPath?: string }) =>
          item.kind === 'generated' && item.localPath,
      ) as
        | { id?: string; localPath?: string; filename?: string; mimeType?: string | null }
        | undefined;
      if (!asset?.localPath) {
        throw new BadGatewayException('Não gerou o vídeo');
      }

      return this.prisma.creativeVideoLivreClip.update({
        where: { id },
        data: {
          status: VIDEO_LIVRE_CLIP_STATUS.READY,
          error: '',
          videoProjectId: project.id,
          localPath: asset.localPath,
          filename: asset.filename || 'video.mp4',
          mimeType: asset.mimeType || 'video/mp4',
        },
        include: clipInclude,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar o vídeo';
      await this.prisma.creativeVideoLivreClip.update({
        where: { id },
        data: {
          status: VIDEO_LIVRE_CLIP_STATUS.FAILED,
          error: message.slice(0, 500),
        },
      });
      throw error instanceof BadGatewayException ||
        error instanceof BadRequestException
        ? error
        : new BadGatewayException(message);
    }
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

  private async attachCharacter(
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
        'Gere ou envie uma foto do personagem em Personagens antes de usar no vídeo',
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
}
