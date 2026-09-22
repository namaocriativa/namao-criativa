import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  defaultImageProjectSettings,
  findImageModel,
  normalizeImageProjectSettings,
} from '../image-studio/image-models';
import type { ImageInlineInput } from '../image-studio/image-provider';
import { GeminiImageProvider } from '../image-studio/gemini-image.provider';
import { PrismaService } from '../prisma/prisma.service';
import {
  StorageService,
  UPLOAD_MIME_TYPES,
} from '../storage/storage.service';
import {
  defaultVideoProjectSettings,
  normalizeVideoProjectSettings,
} from '../video-studio/video-models';
import type { VideoInlineImage } from '../video-studio/video-provider';
import { GeminiVideoProvider } from '../video-studio/gemini-video.provider';
import { PERSONAGENS_ID, findCreativeFeature } from './creative-features';
import type {
  CreateCharacterDto,
  GenerateCharacterPhotoDto,
  GenerateCharacterVideoDto,
  UpdateCharacterDto,
} from './dto/character.dto';
import {
  CHARACTER_ASSET_KIND,
  buildCharacterIdentityPrompt,
  characterPhotoPrompt,
  characterPortraitPrompt,
  characterVideoPrompt,
  mergeCharacterSystemInstruction,
} from './personagens.planner';
import { assertSameTenant, requireTenantId, tenantWhere } from '../tenant/tenant.util';

export type CharacterUploadFile = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_INLINE_BYTES = 15 * 1024 * 1024;
const MAX_UPLOADS = 8;
const MAX_IDENTITY_REFS = 8;
const ALLOWED_IMAGE_MIME = new Set<string>(UPLOAD_MIME_TYPES);

const characterInclude = {
  assets: { orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class CreativeCharacterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly geminiImages: GeminiImageProvider,
    private readonly geminiVideos: GeminiVideoProvider,
  ) {}

  async findAll() {
    return this.prisma.creativeCharacter.findMany({
      where: tenantWhere(),
      orderBy: { updatedAt: 'desc' },
      include: characterInclude,
    });
  }

  async findById(id: string) {
    const character = await this.prisma.creativeCharacter.findUnique({
      where: { id },
      include: characterInclude,
    });
    if (!character) {
      throw new NotFoundException(`Personagem ${id} não encontrado`);
    }
    return assertSameTenant(character, `Personagem ${id} não encontrado`);
  }

  async create(
    dto: CreateCharacterDto,
    files: CharacterUploadFile[],
    userId?: string,
  ) {
    const name = dto.name.trim();
    const appearance = dto.appearance.trim();
    if (!name || !appearance) {
      throw new BadRequestException('Informe nome e aparência');
    }
    if (files.length > MAX_UPLOADS) {
      throw new BadRequestException(`Envie no máximo ${MAX_UPLOADS} fotos`);
    }

    const personality = dto.personality?.trim() || '';
    const identityPrompt = buildCharacterIdentityPrompt({
      name,
      appearance,
      personality,
    });
    const character = await this.prisma.creativeCharacter.create({
      data: {
        tenantId: requireTenantId(),
        name,
        appearance,
        personality,
        identityPrompt,
        createdByUserId: userId || null,
      },
    });

    await this.saveUploads(character.id, files);
    if (dto.generatePortrait !== false) {
      await this.generatePhoto(character.id, {});
    }
    return this.findById(character.id);
  }

  async update(id: string, dto: UpdateCharacterDto) {
    const current = await this.findById(id);
    const name = dto.name?.trim() || current.name;
    const appearance = dto.appearance?.trim() || current.appearance;
    const personality =
      dto.personality === undefined
        ? current.personality
        : dto.personality.trim();
    return this.prisma.creativeCharacter.update({
      where: { id },
      data: {
        name,
        appearance,
        personality,
        identityPrompt: buildCharacterIdentityPrompt({
          name,
          appearance,
          personality,
        }),
      },
      include: characterInclude,
    });
  }

  async deleteById(id: string) {
    await this.findById(id);
    const [ugcCount, shotCount, castCount] = await Promise.all([
      this.prisma.creativeUgcClip.count({ where: { characterId: id } }),
      this.prisma.creativeMovieShot.count({ where: { characterId: id } }),
      this.prisma.creativeMovieShotCast.count({ where: { characterId: id } }),
    ]);
    if (ugcCount || shotCount || castCount) {
      throw new ConflictException(
        'Este personagem está em Filmes ou UGC Skills. Exclua esses clipes antes.',
      );
    }
    await this.storage.removeCharacterDir(id);
    await this.prisma.creativeCharacter.delete({ where: { id } });
    return { id, deleted: true };
  }

  async generatePhoto(id: string, dto: GenerateCharacterPhotoDto) {
    const character = await this.findById(id);
    const feature = findCreativeFeature(PERSONAGENS_ID);
    const defaults = feature?.defaults || {};
    const identity = {
      name: character.name,
      appearance: character.appearance,
      personality: character.personality,
    };
    const prompt = dto.prompt?.trim()
      ? characterPhotoPrompt(identity, dto.prompt)
      : characterPortraitPrompt(identity);
    const settings = normalizeImageProjectSettings({
      ...defaultImageProjectSettings(),
      model: defaults.model || 'gemini-3-pro-image',
      aspectRatio: dto.aspectRatio || defaults.aspectRatio || '3:4',
      imageSize: dto.imageSize || defaults.imageSize || '1K',
      systemInstruction: mergeCharacterSystemInstruction(
        character.identityPrompt,
      ),
      googleSearch: false,
      imageSearch: false,
      includeThoughts: false,
    });
    const model = findImageModel(settings.model);
    if (!model) {
      throw new BadRequestException(`Modelo não suportado: ${settings.model}`);
    }

    const referenceImages = await this.loadIdentityImages(
      character.assets,
      model.capabilities.maxReferences,
    );

    let result;
    try {
      result = await this.geminiImages.generate({
        model: settings.model,
        prompt,
        history: [],
        referenceImages,
        settings,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar foto';
      throw new BadGatewayException(message);
    }

    const image = result.images[0];
    if (!image) {
      throw new BadGatewayException(
        result.text || 'Gemini não devolveu imagem do personagem',
      );
    }

    const hasSheet = character.assets.some(
      (asset) => asset.kind === CHARACTER_ASSET_KIND.SHEET,
    );
    const kind = hasSheet
      ? CHARACTER_ASSET_KIND.PHOTO
      : CHARACTER_ASSET_KIND.SHEET;
    const saved = await this.storage.saveCharacterAsset(
      id,
      image.buffer,
      `${kind}.jpg`,
      image.mimeType,
      kind,
    );
    await this.prisma.creativeCharacterAsset.create({
      data: {
        characterId: id,
        kind,
        localPath: saved.localPath,
        filename: saved.filename,
        mimeType: saved.mimeType,
      },
    });
    return this.touch(id);
  }

  async generateVideo(id: string, dto: GenerateCharacterVideoDto) {
    const character = await this.findById(id);
    const identity = {
      name: character.name,
      appearance: character.appearance,
      personality: character.personality,
    };
    const prompt = characterVideoPrompt(identity, dto.prompt || '');
    const settings = normalizeVideoProjectSettings({
      ...defaultVideoProjectSettings(),
      aspectRatio: dto.aspectRatio,
      duration: dto.duration,
      resolution: dto.resolution,
    });
    const frames = await this.loadVideoFrames(character.assets);

    let result;
    try {
      result = await this.geminiVideos.generate({
        model: settings.model,
        prompt,
        frames,
        settings,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar vídeo';
      throw new BadGatewayException(message);
    }

    const video = result.videos[0];
    if (!video) {
      throw new BadGatewayException(
        result.text || 'Gemini não devolveu vídeo do personagem',
      );
    }
    const saved = await this.storage.saveCharacterAsset(
      id,
      video.buffer,
      'clip.mp4',
      video.mimeType || 'video/mp4',
      CHARACTER_ASSET_KIND.VIDEO,
    );
    await this.prisma.creativeCharacterAsset.create({
      data: {
        characterId: id,
        kind: CHARACTER_ASSET_KIND.VIDEO,
        localPath: saved.localPath,
        filename: saved.filename,
        mimeType: saved.mimeType,
      },
    });
    return this.touch(id);
  }

  async identityImageFiles(id: string) {
    const character = await this.findById(id);
    const files: Array<{
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    }> = [];
    for (const asset of pickIdentityAssets(character.assets, MAX_IDENTITY_REFS)) {
      const buffer = await this.storage.readStorageFile(asset.localPath);
      if (!buffer?.length || buffer.length > MAX_INLINE_BYTES) continue;
      files.push({
        buffer,
        originalname: asset.filename || 'character.jpg',
        mimetype: asset.mimeType || 'image/jpeg',
        size: buffer.length,
      });
    }
    return { character, files };
  }

  async heroImageFile(id: string) {
    const character = await this.findById(id);
    const hero = pickCharacterHero(character.assets);
    if (!hero) return { character, file: null };
    const buffer = await this.storage.readStorageFile(hero.localPath);
    if (!buffer?.length || buffer.length > MAX_INLINE_BYTES) {
      return { character, file: null };
    }
    return {
      character,
      file: {
        buffer,
        originalname: hero.filename || 'character.jpg',
        mimetype: hero.mimeType || 'image/jpeg',
        size: buffer.length,
      },
    };
  }

  private async saveUploads(characterId: string, files: CharacterUploadFile[]) {
    for (const file of files) {
      const mime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_IMAGE_MIME.has(mime)) {
        throw new BadRequestException(
          `Tipo não permitido: ${file.originalname || mime || 'arquivo'}`,
        );
      }
      if ((file.size ?? file.buffer?.length ?? 0) > MAX_UPLOAD_BYTES) {
        throw new BadRequestException(
          `Arquivo grande demais: ${file.originalname || 'imagem'}`,
        );
      }
      const buffer = file.buffer?.length
        ? file.buffer
        : Buffer.alloc(0);
      if (!buffer.length) {
        throw new BadRequestException('Arquivo vazio');
      }
      const saved = await this.storage.saveCharacterAsset(
        characterId,
        buffer,
        file.originalname || 'upload',
        mime,
        'ref',
      );
      await this.prisma.creativeCharacterAsset.create({
        data: {
          characterId,
          kind: CHARACTER_ASSET_KIND.UPLOAD,
          localPath: saved.localPath,
          filename: saved.filename,
          mimeType: saved.mimeType,
        },
      });
    }
  }

  private async loadIdentityImages(
    assets: Array<{
      kind: string;
      localPath: string;
      mimeType: string | null;
    }>,
    maxReferences: number,
  ): Promise<ImageInlineInput[]> {
    const selected = pickIdentityAssets(
      assets,
      Math.min(MAX_IDENTITY_REFS, maxReferences),
    );
    const images: ImageInlineInput[] = [];
    for (const asset of selected) {
      const buffer = await this.storage.readStorageFile(asset.localPath);
      if (!buffer?.length || buffer.length > MAX_INLINE_BYTES) continue;
      images.push({
        mimeType: asset.mimeType || 'image/png',
        data: buffer.toString('base64'),
      });
    }
    return images;
  }

  private async loadVideoFrames(
    assets: Array<{
      kind: string;
      localPath: string;
      mimeType: string | null;
      createdAt: Date;
    }>,
  ): Promise<VideoInlineImage[]> {
    const hero = pickCharacterHero(assets);
    if (!hero) return [];
    const buffer = await this.storage.readStorageFile(hero.localPath);
    if (!buffer?.length || buffer.length > MAX_INLINE_BYTES) return [];
    return [
      {
        mimeType: hero.mimeType || 'image/png',
        data: buffer.toString('base64'),
      },
    ];
  }

  private async touch(id: string) {
    await this.prisma.creativeCharacter.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    return this.findById(id);
  }
}

export function pickCharacterHero<T extends { kind: string }>(
  assets: T[],
): T | undefined {
  const reversed = [...assets].reverse();
  return (
    reversed.find((asset) => asset.kind === CHARACTER_ASSET_KIND.SHEET) ||
    reversed.find((asset) => asset.kind === CHARACTER_ASSET_KIND.PHOTO) ||
    reversed.find((asset) => asset.kind === CHARACTER_ASSET_KIND.UPLOAD)
  );
}

export function pickIdentityAssets<
  T extends { kind: string },
>(assets: T[], max: number): T[] {
  const uploads = assets.filter((asset) => asset.kind === CHARACTER_ASSET_KIND.UPLOAD);
  const sheets = assets.filter((asset) => asset.kind === CHARACTER_ASSET_KIND.SHEET);
  const photos = assets.filter((asset) => asset.kind === CHARACTER_ASSET_KIND.PHOTO);
  return [...uploads, ...sheets, ...photos].slice(0, max);
}
