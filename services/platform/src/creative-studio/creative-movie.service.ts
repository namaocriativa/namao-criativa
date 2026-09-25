import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GeminiVideoProvider } from '../video-studio/gemini-video.provider';
import { mergeVideoProjectSettings } from '../video-studio/video-models';
import type { VideoInlineImage } from '../video-studio/video-provider';
import { isGeneratingLocked } from './clip-runtime';
import { CreativeCharacterService } from './creative-character.service';
import {
  CreateMovieDto,
  CreateMovieShotDto,
  GenerateMovieShotDto,
  MAX_MOVIE_SHOT_CAST,
  UpdateMovieDto,
  UpdateMovieShotDto,
} from './dto/movie.dto';
import {
  resolveMovieCamera,
  resolveMovieFraming,
} from './movies.direction';
import { MOVIE_SHOT_STATUS, movieShotPrompt } from './movies.planner';
import { assertSameTenant, requireTenantId, tenantWhere } from '../tenant/tenant.util';

const MAX_SHOTS = 12;
const MAX_INLINE_BYTES = 15 * 1024 * 1024;

const characterWithAssets = {
  include: { assets: { orderBy: { createdAt: 'asc' as const } } },
} as const;

const shotInclude = {
  character: characterWithAssets,
  cast: {
    orderBy: { sortOrder: 'asc' as const },
    include: { character: characterWithAssets },
  },
} as const;

function uniqueCharacterIds(
  ids: Array<string | undefined | null> | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids || []) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_MOVIE_SHOT_CAST) break;
  }
  return out;
}

const movieInclude = {
  shots: {
    orderBy: { sortOrder: 'asc' as const },
    include: shotInclude,
  },
} as const;

@Injectable()
export class CreativeMovieService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly characters: CreativeCharacterService,
    private readonly geminiVideos: GeminiVideoProvider,
  ) {}

  async findAll() {
    return this.prisma.creativeMovie.findMany({
      where: tenantWhere(),
      orderBy: { updatedAt: 'desc' },
      include: movieInclude,
    });
  }

  async findById(id: string) {
    const movie = await this.prisma.creativeMovie.findUnique({
      where: { id },
      include: movieInclude,
    });
    if (!movie) {
      throw new NotFoundException(`Filme ${id} não encontrado`);
    }
    return assertSameTenant(movie, `Filme ${id} não encontrado`);
  }

  async create(dto: CreateMovieDto, userId?: string) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Informe o título');
    const settings = mergeVideoProjectSettings(dto);
    return this.prisma.creativeMovie.create({
      data: {
        tenantId: requireTenantId(),
        title,
        aspectRatio: settings.aspectRatio,
        duration: settings.duration,
        createdByUserId: userId || null,
      },
      include: movieInclude,
    });
  }

  async update(id: string, dto: UpdateMovieDto) {
    const movie = await this.findById(id);
    const settings = mergeVideoProjectSettings(
      { aspectRatio: movie.aspectRatio, duration: movie.duration },
      dto,
    );
    return this.prisma.creativeMovie.update({
      where: { id },
      data: {
        title: dto.title?.trim() || movie.title,
        aspectRatio: settings.aspectRatio,
        duration: settings.duration,
      },
      include: movieInclude,
    });
  }

  async deleteById(id: string) {
    await this.findById(id);
    await this.storage.removeMovieDir(id);
    await this.prisma.creativeMovie.delete({ where: { id } });
    return { id, deleted: true };
  }

  async addShot(movieId: string, dto: CreateMovieShotDto) {
    const movie = await this.findById(movieId);
    if (movie.shots.length >= MAX_SHOTS) {
      throw new BadRequestException(`No máximo ${MAX_SHOTS} takes por filme`);
    }
    const characterIds = await this.requireCastIds(
      dto.characterIds,
      dto.characterId,
    );
    const characterAssets = await this.requireCharacterAssets(
      characterIds,
      dto.characterAssets,
    );
    const scene = dto.scene.trim();
    const action = dto.action.trim();
    if (!scene || !action) {
      throw new BadRequestException('Informe cenário e ação');
    }
    const sortOrder =
      movie.shots.reduce((max, shot) => Math.max(max, shot.sortOrder), -1) + 1;
    await this.prisma.$transaction(async (tx) => {
      const shot = await tx.creativeMovieShot.create({
        data: {
          movieId,
          characterId: characterIds[0],
          sortOrder,
          scene,
          action,
          dialogue: dto.dialogue?.trim() || '',
          framing: resolveMovieFraming(dto.framing).id,
          camera: resolveMovieCamera(dto.camera).id,
          status: MOVIE_SHOT_STATUS.DRAFT,
        },
        select: { id: true },
      });
      await tx.creativeMovieShotCast.createMany({
        data: characterIds.map((characterId, index) => ({
          shotId: shot.id,
          characterId,
          assetId: characterAssets.get(characterId) || null,
          sortOrder: index,
        })),
      });
    });
    return this.touch(movieId);
  }

  async updateShot(movieId: string, shotId: string, dto: UpdateMovieShotDto) {
    const shot = await this.requireShot(movieId, shotId);
    if (shot.status === MOVIE_SHOT_STATUS.GENERATING) {
      throw new ConflictException('Aguarde o take terminar de gerar');
    }
    const currentCastIds = (shot.cast || []).map((item) => item.characterId);
    const characterIds =
      dto.characterIds !== undefined || dto.characterId
        ? await this.requireCastIds(dto.characterIds, dto.characterId)
        : currentCastIds.length
          ? currentCastIds
          : [shot.characterId];
    const shouldUpdateCast =
      dto.characterIds !== undefined ||
      Boolean(dto.characterId) ||
      dto.characterAssets !== undefined;
    const requestedAssets = {
      ...Object.fromEntries(
        (shot.cast || [])
          .filter((item) => item.assetId)
          .map((item) => [item.characterId, item.assetId as string]),
      ),
      ...(dto.characterAssets || {}),
    };
    const characterAssets = shouldUpdateCast
      ? await this.requireCharacterAssets(characterIds, requestedAssets)
      : new Map<string, string>();
    await this.prisma.$transaction(async (tx) => {
      await tx.creativeMovieShot.update({
        where: { id: shotId },
        data: {
          characterId: characterIds?.[0] || shot.characterId,
          scene: dto.scene?.trim() || shot.scene,
          action: dto.action?.trim() || shot.action,
          dialogue:
            dto.dialogue !== undefined ? dto.dialogue.trim() : shot.dialogue,
          framing:
            dto.framing !== undefined
              ? resolveMovieFraming(dto.framing).id
              : shot.framing,
          camera:
            dto.camera !== undefined
              ? resolveMovieCamera(dto.camera).id
              : shot.camera,
          sortOrder:
            typeof dto.sortOrder === 'number' ? dto.sortOrder : shot.sortOrder,
        },
      });
      if (shouldUpdateCast) {
        await tx.creativeMovieShotCast.deleteMany({ where: { shotId } });
        await tx.creativeMovieShotCast.createMany({
          data: characterIds.map((characterId, index) => ({
            shotId,
            characterId,
            assetId: characterAssets.get(characterId) || null,
            sortOrder: index,
          })),
        });
      }
    });
    return this.touch(movieId);
  }

  async deleteShot(movieId: string, shotId: string) {
    const shot = await this.requireShot(movieId, shotId);
    if (shot.status === MOVIE_SHOT_STATUS.GENERATING) {
      throw new ConflictException('Aguarde o take terminar de gerar');
    }
    await this.prisma.creativeMovieShot.delete({ where: { id: shotId } });
    const remaining = await this.prisma.creativeMovieShot.findMany({
      where: { movieId },
      orderBy: { sortOrder: 'asc' },
    });
    await Promise.all(
      remaining.map((item, index) =>
        this.prisma.creativeMovieShot.update({
          where: { id: item.id },
          data: { sortOrder: index },
        }),
      ),
    );
    return this.touch(movieId);
  }

  async generateShot(
    movieId: string,
    shotId: string,
    dto?: GenerateMovieShotDto,
  ) {
    const movie = await this.findById(movieId);
    const shot = movie.shots.find((item) => item.id === shotId);
    if (!shot) {
      throw new NotFoundException(`Take ${shotId} não encontrado`);
    }
    if (isGeneratingLocked(shot.status, shot.updatedAt)) {
      throw new ConflictException('Este take já está gerando');
    }
    const settings = mergeVideoProjectSettings(
      { aspectRatio: movie.aspectRatio, duration: movie.duration },
      dto,
    );
    await this.prisma.creativeMovie.update({
      where: { id: movieId },
      data: {
        aspectRatio: settings.aspectRatio,
        duration: settings.duration,
      },
    });
    await this.prisma.creativeMovieShot.update({
      where: { id: shotId },
      data: { status: MOVIE_SHOT_STATUS.GENERATING, error: '' },
    });

    const cast = this.shotCast(shot);
    const prompt = movieShotPrompt({
      characters: cast.map((item) => ({
        name: item.name,
        appearance: item.appearance,
        personality: item.personality,
      })),
      scene: shot.scene,
      action: shot.action,
      dialogue: shot.dialogue,
      framing: shot.framing,
      camera: shot.camera,
    });
    const frames = await this.loadCastFrames(
      shot.cast?.length
        ? shot.cast.map((item) => ({
            id: item.characterId,
            assetId: item.assetId,
          }))
        : [{ id: shot.characterId }],
    );

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
          result.text || 'Gemini não devolveu o clipe do take',
        );
      }
      const saved = await this.storage.saveMovieAsset(
        movieId,
        video.buffer,
        `shot-${shot.sortOrder + 1}.mp4`,
        video.mimeType || 'video/mp4',
        'shot',
      );
      await this.prisma.creativeMovieShot.update({
        where: { id: shotId },
        data: {
          status: MOVIE_SHOT_STATUS.READY,
          error: '',
          localPath: saved.localPath,
          filename: saved.filename,
          mimeType: saved.mimeType,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar o take';
      await this.prisma.creativeMovieShot.update({
        where: { id: shotId },
        data: { status: MOVIE_SHOT_STATUS.FAILED, error: message },
      });
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(message);
    }
    return this.touch(movieId);
  }

  private async requireCharacterAssets(
    characterIds: string[],
    requested: Record<string, string> | undefined,
  ): Promise<Map<string, string>> {
    const entries = Object.entries(requested || {});
    if (entries.some(([characterId]) => !characterIds.includes(characterId))) {
      throw new BadRequestException(
        'A imagem selecionada precisa pertencer a um personagem do take',
      );
    }
    const selected = new Map<string, string>();
    for (const [characterId, assetId] of entries) {
      if (typeof assetId !== 'string' || !assetId.trim()) {
        throw new BadRequestException('Imagem de personagem inválida');
      }
      const character = await this.characters.findById(characterId);
      const asset = character.assets?.find(
        (item: { id: string; kind: string; mimeType?: string | null }) =>
          item.id === assetId &&
          item.kind !== 'video' &&
          !item.mimeType?.startsWith('video/'),
      );
      if (!asset) {
        throw new BadRequestException(
          `A imagem selecionada não pertence ao personagem ${character.name}`,
        );
      }
      selected.set(characterId, assetId);
    }
    return selected;
  }

  private async requireCastIds(
    characterIds?: string[],
    characterId?: string,
  ): Promise<string[]> {
    const ids = uniqueCharacterIds(
      characterIds?.length ? characterIds : [characterId],
    );
    if (!ids.length) {
      throw new BadRequestException('Selecione pelo menos um personagem');
    }
    for (const id of ids) {
      await this.characters.findById(id);
    }
    return ids;
  }

  private shotCast(shot: {
    characterId: string;
    character?: {
      id: string;
      name: string;
      appearance: string;
      personality: string;
    };
    cast?: Array<{
      characterId: string;
      character?: {
        id: string;
        name: string;
        appearance: string;
        personality: string;
      };
    }>;
  }): Array<{
    id: string;
    name: string;
    appearance: string;
    personality: string;
  }> {
    const fromCast = (shot.cast || [])
      .map((item) => item.character)
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (fromCast.length) {
      return fromCast.map((item) => ({
        id: item.id,
        name: item.name,
        appearance: item.appearance,
        personality: item.personality,
      }));
    }
    if (shot.character) {
      return [
        {
          id: shot.character.id,
          name: shot.character.name,
          appearance: shot.character.appearance,
          personality: shot.character.personality,
        },
      ];
    }
    return [
      {
        id: shot.characterId,
        name: '',
        appearance: '',
        personality: '',
      },
    ];
  }

  private async loadCastFrames(
    cast: Array<{ id: string; assetId?: string | null }>,
  ): Promise<VideoInlineImage[]> {
    const frames: VideoInlineImage[] = [];
    for (const member of cast) {
      const { file } = await this.characters.heroImageFile(
        member.id,
        member.assetId || undefined,
      );
      if (!file?.buffer?.length || file.buffer.length > MAX_INLINE_BYTES) {
        continue;
      }
      frames.push({
        mimeType: file.mimetype || 'image/jpeg',
        data: file.buffer.toString('base64'),
      });
    }
    return frames;
  }

  private async requireShot(movieId: string, shotId: string) {
    const shot = await this.prisma.creativeMovieShot.findFirst({
      where: { id: shotId, movieId },
      include: { cast: true },
    });
    if (!shot) {
      throw new NotFoundException(`Take ${shotId} não encontrado`);
    }
    return shot;
  }

  private async touch(id: string) {
    await this.prisma.creativeMovie.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    return this.findById(id);
  }
}
