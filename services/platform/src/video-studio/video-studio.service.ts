import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VideoAsset, Prisma } from '@prisma/client';
import * as fs from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import {
  StorageService,
  UPLOAD_MIME_TYPES,
} from '../storage/storage.service';
import { CreateVideoProjectDto } from './dto/create-video-project.dto';
import { GenerateVideoDto } from './dto/generate-video.dto';
import { assertSameTenant, requireTenantId, tenantWhere } from '../tenant/tenant.util';
import { UpdateVideoProjectDto } from './dto/update-video-project.dto';
import { GeminiVideoProvider } from './gemini-video.provider';
import {
  defaultVideoProjectSettings,
  findVideoModel,
  normalizeVideoProjectSettings,
  type VideoProjectSettings,
} from './video-models';
import type { VideoInlineImage } from './video-provider';

export type VideoUploadFile = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_INLINE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set<string>(UPLOAD_MIME_TYPES);
const FRAME_KINDS = new Set(['first-frame', 'last-frame']);

const messageInclude = {
  assets: {
    orderBy: { createdAt: 'asc' as const },
  },
};

type FrameKind = 'first-frame' | 'last-frame';

type ResolvedFrame = {
  asset: VideoAsset;
  inline: VideoInlineImage;
};

@Injectable()
export class VideoStudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly geminiVideos: GeminiVideoProvider,
  ) {}

  async findAll() {
    return this.prisma.videoProject.findMany({
      where: tenantWhere(),
      orderBy: { updatedAt: 'desc' },
      include: {
        assets: {
          where: { kind: { in: ['generated', 'first-frame'] } },
          orderBy: { createdAt: 'desc' },
          take: 4,
        },
        _count: { select: { messages: true, assets: true } },
      },
    });
  }

  async findById(id: string) {
    const project = await this.prisma.videoProject.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: messageInclude,
        },
        assets: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!project) {
      throw new NotFoundException(`Projeto ${id} não encontrado`);
    }
    assertSameTenant(project, `Projeto ${id} não encontrado`);
    return {
      ...project,
      settings: this.settingsOf(project.settings),
    };
  }

  async create(dto: CreateVideoProjectDto, userId?: string) {
    const settings = defaultVideoProjectSettings();
    const name = dto.name?.trim() || 'Novo projeto';
    return this.prisma.videoProject.create({
      data: {
        tenantId: requireTenantId(),
        name,
        createdByUserId: userId || null,
        settings: settings as unknown as Prisma.InputJsonValue,
      },
      include: {
        messages: { include: messageInclude },
        assets: true,
        _count: { select: { messages: true, assets: true } },
      },
    });
  }

  async update(id: string, dto: UpdateVideoProjectDto) {
    const project = await this.requireProject(id);
    const current = this.settingsOf(project.settings);
    const nextSettings = normalizeVideoProjectSettings({
      ...current,
      ...(dto.model !== undefined ? { model: dto.model } : {}),
      ...(dto.aspectRatio !== undefined ? { aspectRatio: dto.aspectRatio } : {}),
      ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
      ...(dto.resolution !== undefined ? { resolution: dto.resolution } : {}),
      ...(dto.thinkingLevel !== undefined
        ? { thinkingLevel: dto.thinkingLevel }
        : {}),
    });

    const data: Prisma.VideoProjectUpdateInput = {
      settings: nextSettings as unknown as Prisma.InputJsonValue,
    };
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Informe o nome do projeto');
      data.name = name;
    }

    const updated = await this.prisma.videoProject.update({
      where: { id },
      data,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: messageInclude,
        },
        assets: { orderBy: { createdAt: 'asc' } },
      },
    });
    return { ...updated, settings: nextSettings };
  }

  async deleteById(id: string) {
    const existing = await this.prisma.videoProject.findUnique({
      where: { id },
      select: { id: true, name: true, tenantId: true },
    });
    if (!existing) {
      throw new NotFoundException(`Projeto ${id} não encontrado`);
    }
    assertSameTenant(existing, `Projeto ${id} não encontrado`);
    await this.prisma.videoProject.delete({ where: { id } });
    await this.storage.removeVideoProjectDir(id);
    return { id: existing.id, name: existing.name, deleted: true };
  }

  async library() {
    const projects = await this.prisma.videoProject.findMany({
      where: tenantWhere(),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        assets: {
          where: { kind: 'generated' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            filename: true,
            localPath: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });
    return projects.filter((project) => project.assets.length > 0);
  }

  async addFrames(
    projectId: string,
    slot: FrameKind,
    files: VideoUploadFile[],
  ) {
    await this.requireProject(projectId);
    if (!FRAME_KINDS.has(slot)) {
      throw new BadRequestException('Slot de quadro inválido');
    }
    if (!files.length) {
      throw new BadRequestException('Envie ao menos uma imagem');
    }
    const created: VideoAsset[] = [];
    for (const file of files) {
      const mime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_MIME.has(mime)) {
        throw new BadRequestException(
          `Tipo não permitido: ${file.originalname || mime || 'arquivo'}`,
        );
      }
      if ((file.size ?? file.buffer?.length ?? 0) > MAX_UPLOAD_BYTES) {
        throw new BadRequestException(
          `Arquivo grande demais: ${file.originalname || 'imagem'}`,
        );
      }
      const buffer = await this.readUploadBuffer(file);
      if (!buffer.length) {
        throw new BadRequestException('Arquivo vazio');
      }
      const saved = await this.storage.saveVideoProjectAsset(
        projectId,
        buffer,
        file.originalname || 'upload',
        mime,
        slot === 'first-frame' ? 'first' : 'last',
      );
      created.push(
        await this.prisma.videoAsset.create({
          data: {
            projectId,
            kind: slot,
            localPath: saved.localPath,
            filename: saved.filename,
            mimeType: saved.mimeType,
          },
        }),
      );
    }
    await this.touch(projectId);
    return created;
  }

  async deleteAsset(projectId: string, assetId: string) {
    const asset = await this.prisma.videoAsset.findFirst({
      where: { id: assetId, projectId },
    });
    if (!asset) {
      throw new NotFoundException(`Arquivo ${assetId} não encontrado`);
    }
    await this.storage.removeImageFile(asset.localPath);
    await this.prisma.videoAsset.delete({ where: { id: asset.id } });
    await this.touch(projectId);
    return { id: asset.id, deleted: true };
  }

  async generate(projectId: string, dto: GenerateVideoDto) {
    const project = await this.requireProject(projectId);
    const prompt = dto.prompt.trim();
    if (!prompt) {
      throw new BadRequestException('Informe um prompt');
    }

    const settings = normalizeVideoProjectSettings({
      ...this.settingsOf(project.settings),
      ...(dto.model !== undefined ? { model: dto.model } : {}),
      ...(dto.aspectRatio !== undefined ? { aspectRatio: dto.aspectRatio } : {}),
      ...(dto.duration !== undefined ? { duration: dto.duration } : {}),
      ...(dto.resolution !== undefined ? { resolution: dto.resolution } : {}),
      ...(dto.thinkingLevel !== undefined
        ? { thinkingLevel: dto.thinkingLevel }
        : {}),
    });

    const model = findVideoModel(settings.model);
    if (!model) {
      throw new BadRequestException(`Modelo não suportado: ${settings.model}`);
    }

    if (dto.lastFrameImageAssetId && !dto.firstFrameImageAssetId && !dto.firstFrameAssetId) {
      throw new BadRequestException('Quadro final exige um quadro inicial');
    }
    if (dto.lastFrameAssetId && !dto.firstFrameImageAssetId && !dto.firstFrameAssetId) {
      throw new BadRequestException('Quadro final exige um quadro inicial');
    }

    const first = await this.resolveFrame(
      projectId,
      'first-frame',
      dto.firstFrameImageAssetId,
      dto.firstFrameAssetId,
    );
    const last = await this.resolveFrame(
      projectId,
      'last-frame',
      dto.lastFrameImageAssetId,
      dto.lastFrameAssetId,
    );

    const frames = [first, last]
      .filter((frame): frame is ResolvedFrame => Boolean(frame))
      .map((frame) => frame.inline);

    const previousInteractionId = frames.length
      ? undefined
      : await this.lastInteractionId(projectId);

    if (model.provider !== 'gemini') {
      throw new BadRequestException(`Provider não suportado: ${model.provider}`);
    }

    let result;
    try {
      result = await this.geminiVideos.generate({
        model: settings.model,
        prompt,
        frames,
        previousInteractionId,
        settings,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar vídeo';
      throw new BadGatewayException(message);
    }

    const userMessage = await this.prisma.videoMessage.create({
      data: {
        projectId,
        role: 'user',
        kind: 'generation',
        text: prompt,
        settings: settings as unknown as Prisma.InputJsonValue,
      },
    });

    const frameAssets = [first, last].filter(
      (frame): frame is ResolvedFrame => Boolean(frame),
    );
    if (frameAssets.length) {
      await this.prisma.videoAsset.updateMany({
        where: {
          id: { in: frameAssets.map((frame) => frame.asset.id) },
          projectId,
        },
        data: { messageId: userMessage.id },
      });
    }

    const modelMessage = await this.prisma.videoMessage.create({
      data: {
        projectId,
        role: 'model',
        kind: 'generation',
        text: result.text || null,
        thoughts: result.thoughts || null,
        model: settings.model,
        settings: settings as unknown as Prisma.InputJsonValue,
        providerInteractionId: result.interactionId || null,
        usage: result.usage
          ? (result.usage as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    const generatedAssets: VideoAsset[] = [];
    for (const [index, video] of result.videos.entries()) {
      const saved = await this.storage.saveVideoProjectAsset(
        projectId,
        video.buffer,
        `generated-${index + 1}`,
        video.mimeType || 'video/mp4',
        'gen',
      );
      generatedAssets.push(
        await this.prisma.videoAsset.create({
          data: {
            projectId,
            messageId: modelMessage.id,
            kind: 'generated',
            localPath: saved.localPath,
            filename: saved.filename,
            mimeType: saved.mimeType,
          },
        }),
      );
    }

    await this.prisma.videoProject.update({
      where: { id: projectId },
      data: {
        settings: settings as unknown as Prisma.InputJsonValue,
      },
    });

    const user = await this.prisma.videoMessage.findUniqueOrThrow({
      where: { id: userMessage.id },
      include: messageInclude,
    });
    const assistant = await this.prisma.videoMessage.findUniqueOrThrow({
      where: { id: modelMessage.id },
      include: messageInclude,
    });

    return {
      settings,
      userMessage: user,
      modelMessage: assistant,
      assets: generatedAssets,
      usage: result.usage || null,
    };
  }

  settingsOf(raw: unknown): VideoProjectSettings {
    return normalizeVideoProjectSettings(raw);
  }

  private async requireProject(id: string) {
    const project = await this.prisma.videoProject.findUnique({
      where: { id },
    });
    if (!project) {
      throw new NotFoundException(`Projeto ${id} não encontrado`);
    }
    return assertSameTenant(project, `Projeto ${id} não encontrado`);
  }

  private async touch(projectId: string) {
    await this.prisma.videoProject.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });
  }

  private async lastInteractionId(
    projectId: string,
  ): Promise<string | undefined> {
    const last = await this.prisma.videoMessage.findFirst({
      where: {
        projectId,
        kind: 'generation',
        role: 'model',
        providerInteractionId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { providerInteractionId: true },
    });
    return last?.providerInteractionId || undefined;
  }

  private async resolveFrame(
    projectId: string,
    kind: FrameKind,
    imageAssetId?: string,
    videoAssetId?: string,
  ): Promise<ResolvedFrame | null> {
    if (imageAssetId) {
      const source = await this.prisma.imageAsset.findUnique({
        where: { id: imageAssetId },
      });
      if (!source) {
        throw new BadRequestException(
          'Imagem não encontrada na aba Imagens',
        );
      }
      const inline = await this.fileToInline(source.localPath, source.mimeType);
      if (!inline) {
        throw new BadRequestException(
          `Não foi possível ler a imagem ${source.filename}`,
        );
      }
      const saved = await this.storage.saveVideoProjectAsset(
        projectId,
        Buffer.from(inline.data, 'base64'),
        source.filename,
        source.mimeType,
        kind === 'first-frame' ? 'first' : 'last',
      );
      const asset = await this.prisma.videoAsset.create({
        data: {
          projectId,
          kind,
          localPath: saved.localPath,
          filename: saved.filename,
          mimeType: saved.mimeType,
        },
      });
      return { asset, inline };
    }

    if (!videoAssetId) return null;

    const asset = await this.prisma.videoAsset.findFirst({
      where: { id: videoAssetId, projectId },
    });
    if (!asset) {
      throw new BadRequestException('Quadro inválido para este projeto');
    }
    const inline = await this.fileToInline(asset.localPath, asset.mimeType);
    if (!inline) {
      throw new BadRequestException(
        `Não foi possível ler o quadro ${asset.filename}`,
      );
    }
    return { asset, inline };
  }

  private async fileToInline(
    localPath: string,
    mimeType: string | null,
  ): Promise<VideoInlineImage | null> {
    const buffer = await this.storage.readStorageFile(localPath);
    if (!buffer?.length || buffer.length > MAX_INLINE_BYTES) return null;
    return {
      mimeType: mimeType || 'image/png',
      data: buffer.toString('base64'),
    };
  }

  private async readUploadBuffer(file: VideoUploadFile): Promise<Buffer> {
    if (file.buffer && file.buffer.length) return file.buffer;
    if (file.path) return fs.readFile(file.path);
    return Buffer.alloc(0);
  }
}
