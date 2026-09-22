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
import { isGeneratingLocked } from './clip-runtime';
import { CreativeCharacterService } from './creative-character.service';
import type {
  CreateUgcClipDto,
  GenerateUgcClipDto,
} from './dto/ugc-clip.dto';
import { UGC_CLIP_STATUS, ugcSkillsPrompt } from './ugc-skills.planner';
import { assertSameTenant, requireTenantId, tenantWhere } from '../tenant/tenant.util';

export type UgcUploadFile = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

export type UgcUploadFields = {
  product?: UgcUploadFile[];
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_INLINE_BYTES = 15 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set<string>(UPLOAD_MIME_TYPES);

const clipInclude = {
  character: {
    include: {
      assets: { orderBy: { createdAt: 'asc' as const } },
    },
  },
};

@Injectable()
export class CreativeUgcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly geminiVideos: GeminiVideoProvider,
    private readonly characters: CreativeCharacterService,
  ) {}

  async findAll() {
    return this.prisma.creativeUgcClip.findMany({
      where: tenantWhere(),
      orderBy: { updatedAt: 'desc' },
      include: clipInclude,
    });
  }

  async findById(id: string) {
    const clip = await this.prisma.creativeUgcClip.findUnique({
      where: { id },
      include: clipInclude,
    });
    if (!clip) {
      throw new NotFoundException(`Clipe ${id} não encontrado`);
    }
    return assertSameTenant(clip, `Clipe ${id} não encontrado`);
  }

  async create(dto: CreateUgcClipDto, files: UgcUploadFields, userId?: string) {
    const payload = dto || ({} as CreateUgcClipDto);
    const characterId = payload.characterId?.trim();
    if (!characterId) {
      throw new BadRequestException('Selecione um personagem');
    }

    const { character, file: hero } =
      await this.characters.heroImageFile(characterId);
    if (!hero) {
      throw new BadRequestException(
        'Gere uma foto do personagem em Personagens antes de criar o anúncio',
      );
    }

    const productSource = await this.resolveProduct(payload, files);
    const settings = mergeVideoProjectSettings(payload);

    const clip = await this.prisma.creativeUgcClip.create({
      data: {
        tenantId: requireTenantId(),
        characterId: character.id,
        prompt: payload.prompt?.trim() || '',
        duration: settings.duration,
        aspectRatio: settings.aspectRatio,
        resolution: settings.resolution,
        status: UGC_CLIP_STATUS.DRAFT,
        createdByUserId: userId || null,
      },
    });

    try {
      const first = await this.storage.saveUgcSkillsAsset(
        clip.id,
        hero.buffer,
        hero.originalname,
        hero.mimetype,
        'first',
      );
      const product = await this.storage.saveUgcSkillsAsset(
        clip.id,
        productSource.buffer,
        productSource.originalname,
        productSource.mimetype,
        'product',
      );
      await this.prisma.creativeUgcClip.update({
        where: { id: clip.id },
        data: {
          firstFramePath: first.localPath,
          firstFrameName: first.filename,
          firstFrameMime: first.mimeType,
          productPath: product.localPath,
          productName: product.filename,
          productMime: product.mimeType,
        },
      });
    } catch (error) {
      await this.storage.removeUgcSkillsDir(clip.id);
      await this.prisma.creativeUgcClip.delete({ where: { id: clip.id } });
      throw error;
    }

    return this.generate(clip.id, payload);
  }

  async deleteById(id: string) {
    const clip = await this.findById(id);
    if (isGeneratingLocked(clip.status, clip.updatedAt)) {
      throw new ConflictException('Aguarde o clipe terminar de gerar');
    }
    await this.storage.removeUgcSkillsDir(id);
    await this.prisma.creativeUgcClip.delete({ where: { id } });
    return { id, deleted: true };
  }

  async generate(id: string, dto?: GenerateUgcClipDto) {
    const clip = await this.findById(id);
    if (isGeneratingLocked(clip.status, clip.updatedAt)) {
      throw new ConflictException('Este clipe já está gerando');
    }
    if (!clip.firstFramePath || !clip.productPath) {
      throw new BadRequestException(
        'Informe o personagem e a foto do produto',
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
    const prompt = ugcSkillsPrompt({
      name: clip.character.name,
      appearance: clip.character.appearance,
      personality: clip.character.personality,
      identityPrompt: clip.character.identityPrompt,
      prompt: nextPrompt,
      duration: settings.duration,
    });
    const frames = await this.loadFrames(clip);

    await this.prisma.creativeUgcClip.update({
      where: { id },
      data: {
        prompt: nextPrompt,
        duration: settings.duration,
        aspectRatio: settings.aspectRatio,
        resolution: settings.resolution,
        status: UGC_CLIP_STATUS.GENERATING,
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
      const saved = await this.storage.saveUgcSkillsAsset(
        id,
        video.buffer,
        'clip.mp4',
        video.mimeType || 'video/mp4',
        'clip',
      );
      return this.prisma.creativeUgcClip.update({
        where: { id },
        data: {
          status: UGC_CLIP_STATUS.READY,
          error: '',
          localPath: saved.localPath,
          filename: saved.filename,
          mimeType: saved.mimeType,
        },
        include: clipInclude,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar o clipe';
      await this.prisma.creativeUgcClip.update({
        where: { id },
        data: { status: UGC_CLIP_STATUS.FAILED, error: message },
      });
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(message);
    }
  }

  private async loadFrames(clip: {
    firstFramePath: string;
    firstFrameMime: string | null;
    productPath: string;
    productMime: string | null;
  }): Promise<VideoInlineImage[]> {
    const first = await this.fileToInline(
      clip.firstFramePath,
      clip.firstFrameMime,
      'do personagem',
    );
    const product = await this.fileToInline(
      clip.productPath,
      clip.productMime,
      'do produto',
    );
    return [first, product];
  }

  private async fileToInline(
    localPath: string,
    mimeType: string | null,
    label: string,
  ): Promise<VideoInlineImage> {
    const buffer = await this.storage.readStorageFile(localPath);
    if (!buffer?.length || buffer.length > MAX_INLINE_BYTES) {
      throw new BadRequestException(`Não foi possível ler o quadro ${label}`);
    }
    return {
      mimeType: mimeType || 'image/png',
      data: buffer.toString('base64'),
    };
  }

  private async resolveProduct(
    payload: CreateUgcClipDto,
    files: UgcUploadFields,
  ): Promise<{ buffer: Buffer; originalname: string; mimetype: string }> {
    if (files.product?.[0]) {
      return this.readUpload(files.product[0], 'do produto');
    }
    const assetId = payload.productImageAssetId?.trim();
    if (assetId) {
      return this.readImageAsset(assetId, 'do produto');
    }
    const sourceClipId = payload.sourceClipId?.trim();
    if (sourceClipId) {
      const source = await this.prisma.creativeUgcClip.findUnique({
        where: { id: sourceClipId },
      });
      if (!source?.productPath) {
        throw new BadRequestException(
          'Não foi possível reusar a foto do produto deste clipe',
        );
      }
      const buffer = await this.storage.readStorageFile(source.productPath);
      if (!buffer?.length) {
        throw new BadRequestException(
          'Não foi possível ler a foto do produto deste clipe',
        );
      }
      return {
        buffer,
        originalname: source.productName || 'produto.png',
        mimetype: source.productMime || 'image/png',
      };
    }
    throw new BadRequestException('Envie a foto do produto');
  }

  private async readImageAsset(
    assetId: string,
    label: string,
  ): Promise<{ buffer: Buffer; originalname: string; mimetype: string }> {
    const source = await this.prisma.imageAsset.findUnique({
      where: { id: assetId },
    });
    if (!source) {
      throw new BadRequestException(
        `Imagem ${label} não encontrada na aba Imagens`,
      );
    }
    const buffer = await this.storage.readStorageFile(source.localPath);
    if (!buffer?.length) {
      throw new BadRequestException(`Não foi possível ler a imagem ${label}`);
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`Arquivo grande demais: quadro ${label}`);
    }
    const mime =
      (source.mimeType || 'image/png').split(';')[0].trim().toLowerCase() ||
      'image/png';
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      throw new BadRequestException(
        `Tipo não permitido no quadro ${label}: ${mime}`,
      );
    }
    return {
      buffer,
      originalname: source.filename || `${label}.png`,
      mimetype: mime,
    };
  }

  private async readUpload(
    file: UgcUploadFile,
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

  private async readUploadBuffer(file: UgcUploadFile): Promise<Buffer> {
    if (file.buffer && file.buffer.length) return file.buffer;
    if (file.path) return fs.readFile(file.path);
    return Buffer.alloc(0);
  }
}
