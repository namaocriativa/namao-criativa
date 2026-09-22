import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import {
  StorageService,
  UPLOAD_MIME_TYPES,
} from '../storage/storage.service';
import { GeminiVideoProvider } from '../video-studio/gemini-video.provider';
import { mergeVideoProjectSettings } from '../video-studio/video-models';
import type { VideoInlineImage } from '../video-studio/video-provider';
import type {
  CreateStartEndClipDto,
  GenerateStartEndClipDto,
} from './dto/start-end.dto';
import { START_END_STATUS, inicioFimPrompt } from './inicio-fim.planner';
import { isGeneratingLocked } from './clip-runtime';
import { assertSameTenant, requireTenantId, tenantWhere } from '../tenant/tenant.util';

export type StartEndUploadFile = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

export type StartEndUploadFields = {
  firstFrame?: StartEndUploadFile[];
  lastFrame?: StartEndUploadFile[];
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_INLINE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set<string>(UPLOAD_MIME_TYPES);

@Injectable()
export class CreativeStartEndService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly geminiVideos: GeminiVideoProvider,
  ) {}

  async findAll() {
    return this.prisma.creativeStartEndClip.findMany({
      where: tenantWhere(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string) {
    const clip = await this.prisma.creativeStartEndClip.findUnique({
      where: { id },
    });
    if (!clip) {
      throw new NotFoundException(`Clipe ${id} não encontrado`);
    }
    return assertSameTenant(clip, `Clipe ${id} não encontrado`);
  }

  async create(
    dto: CreateStartEndClipDto,
    files: StartEndUploadFields,
    userId?: string,
  ) {
    const payload = dto || {};
    const source = await this.resolveSourceClip(payload.sourceClipId);
    const firstSource = await this.resolveIncomingFrame(
      files.firstFrame?.[0],
      payload.firstFrameImageAssetId,
      'inicial',
      source
        ? {
            path: source.firstFramePath,
            name: source.firstFrameName,
            mime: source.firstFrameMime,
          }
        : undefined,
    );
    const lastSource = await this.resolveIncomingFrame(
      files.lastFrame?.[0],
      payload.lastFrameImageAssetId,
      'final',
      source
        ? {
            path: source.lastFramePath,
            name: source.lastFrameName,
            mime: source.lastFrameMime,
          }
        : undefined,
    );
    const settings = mergeVideoProjectSettings(payload);
    const clip = await this.prisma.creativeStartEndClip.create({
      data: {
        tenantId: requireTenantId(),
        prompt: payload.prompt?.trim() || '',
        duration: settings.duration,
        aspectRatio: settings.aspectRatio,
        resolution: settings.resolution,
        status: START_END_STATUS.DRAFT,
        createdByUserId: userId || null,
      },
    });
    try {
      const first = await this.storage.saveStartEndAsset(
        clip.id,
        firstSource.buffer,
        firstSource.originalname,
        firstSource.mimetype,
        'first',
      );
      const last = await this.storage.saveStartEndAsset(
        clip.id,
        lastSource.buffer,
        lastSource.originalname,
        lastSource.mimetype,
        'last',
      );
      await this.prisma.creativeStartEndClip.update({
        where: { id: clip.id },
        data: {
          firstFramePath: first.localPath,
          firstFrameName: first.filename,
          firstFrameMime: first.mimeType,
          lastFramePath: last.localPath,
          lastFrameName: last.filename,
          lastFrameMime: last.mimeType,
        },
      });
    } catch (error) {
      await this.storage.removeStartEndDir(clip.id);
      await this.prisma.creativeStartEndClip.delete({ where: { id: clip.id } });
      throw error;
    }
    return this.generate(clip.id, payload);
  }

  async deleteById(id: string) {
    const clip = await this.findById(id);
    if (isGeneratingLocked(clip.status, clip.updatedAt)) {
      throw new ConflictException('Aguarde o clipe terminar de gerar');
    }
    await this.storage.removeStartEndDir(id);
    await this.prisma.creativeStartEndClip.delete({ where: { id } });
    return { id, deleted: true };
  }

  async generate(id: string, dto?: GenerateStartEndClipDto) {
    const clip = await this.findById(id);
    if (isGeneratingLocked(clip.status, clip.updatedAt)) {
      throw new ConflictException('Este clipe já está gerando');
    }
    if (!clip.firstFramePath || !clip.lastFramePath) {
      throw new BadRequestException(
        'Informe o quadro inicial e o quadro final',
      );
    }

    const settings = mergeVideoProjectSettings(
      {
        aspectRatio: clip.aspectRatio,
        duration: clip.duration,
        resolution: clip.resolution,
      },
      dto,
    );
    const nextPrompt =
      dto?.prompt !== undefined ? dto.prompt.trim() : clip.prompt;
    const prompt = inicioFimPrompt({
      prompt: nextPrompt,
      duration: settings.duration,
    });
    const frames = await this.loadFrames(clip);

    await this.prisma.creativeStartEndClip.update({
      where: { id },
      data: {
        prompt: nextPrompt,
        duration: settings.duration,
        aspectRatio: settings.aspectRatio,
        resolution: settings.resolution,
        status: START_END_STATUS.GENERATING,
        error: '',
      },
    });

    try {
      const result = await this.geminiVideos.generate({
        model: settings.model,
        prompt,
        frames,
        settings,
      });
      const video = result.videos[0];
      if (!video) {
        throw new BadGatewayException(
          result.text || 'Gemini não devolveu o clipe',
        );
      }
      const saved = await this.storage.saveStartEndAsset(
        id,
        video.buffer,
        'clip.mp4',
        video.mimeType || 'video/mp4',
        'clip',
      );
      return this.prisma.creativeStartEndClip.update({
        where: { id },
        data: {
          status: START_END_STATUS.READY,
          error: '',
          localPath: saved.localPath,
          filename: saved.filename,
          mimeType: saved.mimeType,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar o clipe';
      await this.prisma.creativeStartEndClip.update({
        where: { id },
        data: { status: START_END_STATUS.FAILED, error: message },
      });
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(message);
    }
  }

  private async loadFrames(clip: {
    firstFramePath: string;
    firstFrameMime: string | null;
    lastFramePath: string;
    lastFrameMime: string | null;
  }): Promise<VideoInlineImage[]> {
    const first = await this.fileToInline(
      clip.firstFramePath,
      clip.firstFrameMime,
      'inicial',
    );
    const last = await this.fileToInline(
      clip.lastFramePath,
      clip.lastFrameMime,
      'final',
    );
    return [first, last];
  }

  private async fileToInline(
    localPath: string,
    mimeType: string | null,
    label: string,
  ): Promise<VideoInlineImage> {
    const buffer = await this.storage.readStorageFile(localPath);
    if (!buffer?.length || buffer.length > MAX_INLINE_BYTES) {
      throw new BadRequestException(
        `Não foi possível ler o quadro ${label}`,
      );
    }
    return {
      mimeType: mimeType || 'image/png',
      data: buffer.toString('base64'),
    };
  }

  private async resolveIncomingFrame(
    file: StartEndUploadFile | undefined,
    imageAssetId: string | undefined,
    label: string,
    fallback?: { path: string; name: string; mime: string | null } | null,
  ): Promise<{ buffer: Buffer; originalname: string; mimetype: string }> {
    if (file) {
      return this.readUpload(file, label);
    }
    const assetId = imageAssetId?.trim();
    if (assetId) {
      const source = await this.prisma.imageAsset.findUnique({
        where: { id: assetId },
      });
      if (!source) {
        throw new BadRequestException(
          `Imagem do quadro ${label} não encontrada na aba Imagens`,
        );
      }
      return this.readStoredImage(
        source.localPath,
        source.filename || `${label}.png`,
        source.mimeType,
        label,
      );
    }
    if (fallback?.path) {
      return this.readStoredImage(
        fallback.path,
        fallback.name || `${label}.png`,
        fallback.mime,
        label,
      );
    }
    throw new BadRequestException(`Informe o quadro ${label}`);
  }

  private async resolveSourceClip(sourceClipId?: string) {
    const id = sourceClipId?.trim();
    if (!id) return null;
    const source = await this.prisma.creativeStartEndClip.findUnique({
      where: { id },
    });
    if (!source?.firstFramePath || !source.lastFramePath) {
      throw new BadRequestException(
        'Não foi possível reusar os quadros deste clipe',
      );
    }
    return source;
  }

  private async readStoredImage(
    localPath: string,
    filename: string,
    mimeType: string | null,
    label: string,
  ): Promise<{ buffer: Buffer; originalname: string; mimetype: string }> {
    const buffer = await this.storage.readStorageFile(localPath);
    if (!buffer?.length) {
      throw new BadRequestException(
        `Não foi possível ler a imagem do quadro ${label}`,
      );
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`Arquivo grande demais: quadro ${label}`);
    }
    const mime =
      (mimeType || 'image/png').split(';')[0].trim().toLowerCase() ||
      'image/png';
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      throw new BadRequestException(
        `Tipo não permitido no quadro ${label}: ${mime}`,
      );
    }
    return {
      buffer,
      originalname: filename || `${label}.png`,
      mimetype: mime,
    };
  }

  private async readUpload(
    file: StartEndUploadFile,
    label: string,
  ): Promise<{ buffer: Buffer; originalname: string; mimetype: string }> {
    const mime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      throw new BadRequestException(
        `Tipo não permitido no quadro ${label}: ${file.originalname || mime || 'arquivo'}`,
      );
    }
    if ((file.size ?? file.buffer?.length ?? 0) > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`Arquivo grande demais: quadro ${label}`);
    }
    const buffer = await this.readUploadBuffer(file);
    if (!buffer.length) {
      throw new BadRequestException(`Arquivo vazio no quadro ${label}`);
    }
    return {
      buffer,
      originalname: file.originalname || `${label}.png`,
      mimetype: mime,
    };
  }

  private async readUploadBuffer(file: StartEndUploadFile): Promise<Buffer> {
    if (file.buffer && file.buffer.length) return file.buffer;
    if (file.path) return fs.readFile(file.path);
    return Buffer.alloc(0);
  }
}
