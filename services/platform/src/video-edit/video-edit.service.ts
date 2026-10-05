import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  assertSameTenant,
  requireTenantId,
  tenantWhere,
} from '../tenant/tenant.util';
import {
  createEmptyEditDocument,
  recomputeDuration,
  type EditDocument,
} from './edit-document';
import type { CreateVideoEditDto, UpdateVideoEditDto } from './dto/video-edit.dto';

export type VideoEditUploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

const projectInclude = {
  media: { orderBy: { createdAt: 'desc' as const } },
} as const;

@Injectable()
export class VideoEditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async findAll() {
    return this.prisma.creativeVideoEditProject.findMany({
      where: tenantWhere(),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        exportPath: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findById(id: string) {
    const project = await this.prisma.creativeVideoEditProject.findUnique({
      where: { id },
      include: projectInclude,
    });
    if (!project) {
      throw new NotFoundException(`Projeto ${id} não encontrado`);
    }
    return assertSameTenant(project, `Projeto ${id} não encontrado`);
  }

  async create(dto: CreateVideoEditDto, userId?: string) {
    const tenantId = requireTenantId();
    const name = String(dto.name || '').trim() || 'Projeto sem nome';
    const document = createEmptyEditDocument();
    return this.prisma.creativeVideoEditProject.create({
      data: {
        tenantId,
        name,
        document: document as unknown as Prisma.InputJsonValue,
        createdByUserId: userId || null,
      },
      include: projectInclude,
    });
  }

  async update(id: string, dto: UpdateVideoEditDto) {
    await this.findById(id);
    const data: Prisma.CreativeVideoEditProjectUpdateInput = {};
    if (dto.name !== undefined) {
      const name = String(dto.name).trim();
      if (!name) throw new BadRequestException('Nome inválido');
      data.name = name;
    }
    if (dto.document !== undefined) {
      const doc = this.normalizeDocument(dto.document);
      data.document = doc as unknown as Prisma.InputJsonValue;
    }
    return this.prisma.creativeVideoEditProject.update({
      where: { id },
      data,
      include: projectInclude,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.creativeVideoEditProject.delete({ where: { id } });
    await this.storage.removeVideoEditDir(id);
    return { ok: true };
  }

  async uploadMedia(id: string, file: VideoEditUploadFile | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Arquivo obrigatório');
    }
    await this.findById(id);
    const mime = (file.mimetype || 'application/octet-stream')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (
      !mime.startsWith('video/') &&
      !mime.startsWith('image/') &&
      !mime.startsWith('audio/')
    ) {
      throw new BadRequestException('Tipo de arquivo não suportado');
    }
    const saved = await this.storage.saveVideoEditAsset(
      id,
      file.buffer,
      file.originalname || 'upload.bin',
      mime,
      'upload',
    );
    return this.prisma.creativeVideoEditMedia.create({
      data: {
        projectId: id,
        filename: saved.filename,
        localPath: saved.localPath,
        mimeType: mime,
        source: 'upload',
      },
    });
  }

  async saveExport(id: string, file: VideoEditUploadFile | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Arquivo de exportação obrigatório');
    }
    await this.findById(id);
    const saved = await this.storage.saveVideoEditAsset(
      id,
      file.buffer,
      file.originalname || 'export.mp4',
      file.mimetype || 'video/mp4',
      'export',
    );
    return this.prisma.creativeVideoEditProject.update({
      where: { id },
      data: { exportPath: saved.localPath },
      include: projectInclude,
    });
  }

  async librarySources() {
    const [videoLibs, imageLibs, videoLivre, inicioFim, movies, ugc] =
      await Promise.all([
        this.prisma.videoProject.findMany({
          where: tenantWhere(),
          orderBy: { updatedAt: 'desc' },
          include: {
            assets: {
              where: { kind: 'generated' },
              orderBy: { createdAt: 'desc' },
            },
          },
        }),
        this.prisma.imageProject.findMany({
          where: tenantWhere(),
          orderBy: { updatedAt: 'desc' },
          include: {
            assets: {
              where: { kind: 'generated' },
              orderBy: { createdAt: 'desc' },
            },
          },
        }),
        this.prisma.creativeVideoLivreClip.findMany({
          where: { ...tenantWhere(), localPath: { not: '' } },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        }),
        this.prisma.creativeStartEndClip.findMany({
          where: { ...tenantWhere(), localPath: { not: '' } },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        }),
        this.prisma.creativeMovie.findMany({
          where: tenantWhere(),
          orderBy: { updatedAt: 'desc' },
          take: 40,
          include: {
            shots: {
              where: { localPath: { not: '' } },
              orderBy: { sortOrder: 'asc' },
            },
          },
        }),
        this.prisma.creativeUgcClip.findMany({
          where: { ...tenantWhere(), localPath: { not: '' } },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        }),
      ]);

    type Source = {
      id: string;
      label: string;
      localPath: string;
      mimeType: string;
      createdAt: string;
      origin: string;
      kind: 'video' | 'image' | 'audio';
    };

    const items: Source[] = [];

    for (const project of videoLibs) {
      for (const asset of project.assets) {
        items.push({
          id: `video-asset:${asset.id}`,
          label: `${project.name} · ${asset.filename}`,
          localPath: asset.localPath,
          mimeType: asset.mimeType || 'video/mp4',
          createdAt: asset.createdAt.toISOString(),
          origin: 'video-projects',
          kind: 'video',
        });
      }
    }

    for (const project of imageLibs) {
      for (const asset of project.assets) {
        items.push({
          id: `image-asset:${asset.id}`,
          label: `${project.name} · ${asset.filename}`,
          localPath: asset.localPath,
          mimeType: asset.mimeType || 'image/png',
          createdAt: asset.createdAt.toISOString(),
          origin: 'image-projects',
          kind: 'image',
        });
      }
    }

    for (const clip of videoLivre) {
      items.push({
        id: `video-livre:${clip.id}`,
        label: clip.title || clip.filename || 'Vídeo livre',
        localPath: clip.localPath,
        mimeType: clip.mimeType || 'video/mp4',
        createdAt: clip.createdAt.toISOString(),
        origin: 'video-livre',
        kind: 'video',
      });
    }

    for (const clip of inicioFim) {
      items.push({
        id: `inicio-fim:${clip.id}`,
        label: clip.filename || clip.prompt?.slice(0, 40) || 'Início e fim',
        localPath: clip.localPath,
        mimeType: clip.mimeType || 'video/mp4',
        createdAt: clip.createdAt.toISOString(),
        origin: 'inicio-fim',
        kind: 'video',
      });
    }

    for (const movie of movies) {
      for (const shot of movie.shots) {
        items.push({
          id: `movie-shot:${shot.id}`,
          label: `${movie.title || 'Filme'} · take ${shot.sortOrder + 1}`,
          localPath: shot.localPath,
          mimeType: shot.mimeType || 'video/mp4',
          createdAt: shot.createdAt.toISOString(),
          origin: 'movies',
          kind: 'video',
        });
      }
    }

    for (const clip of ugc) {
      items.push({
        id: `ugc:${clip.id}`,
        label: clip.filename || clip.prompt?.slice(0, 40) || 'UGC',
        localPath: clip.localPath,
        mimeType: clip.mimeType || 'video/mp4',
        createdAt: clip.createdAt.toISOString(),
        origin: 'ugc-skills',
        kind: 'video',
      });
    }

    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return { items };
  }

  private normalizeDocument(raw: Record<string, unknown>): EditDocument {
    const base = createEmptyEditDocument();
    const doc = {
      ...base,
      ...raw,
      version: 1 as const,
      canvas: {
        ...base.canvas,
        ...(typeof raw.canvas === 'object' && raw.canvas
          ? (raw.canvas as EditDocument['canvas'])
          : {}),
      },
      tracks: Array.isArray(raw.tracks)
        ? (raw.tracks as EditDocument['tracks'])
        : base.tracks,
      mediaLibrary:
        typeof raw.mediaLibrary === 'object' && raw.mediaLibrary
          ? (raw.mediaLibrary as EditDocument['mediaLibrary'])
          : {},
      fps: typeof raw.fps === 'number' ? raw.fps : base.fps,
    };
    doc.durationMs = recomputeDuration(doc);
    return doc;
  }
}
