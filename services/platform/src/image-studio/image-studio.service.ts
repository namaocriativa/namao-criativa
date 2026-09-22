import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImageAsset, Prisma } from '@prisma/client';
import * as fs from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import {
  StorageService,
  UPLOAD_MIME_TYPES,
} from '../storage/storage.service';
import { CreateImageProjectDto } from './dto/create-image-project.dto';
import { GenerateImageDto } from './dto/generate-image.dto';
import { UpdateImageProjectDto } from './dto/update-image-project.dto';
import { GeminiImageProvider } from './gemini-image.provider';
import {
  defaultImageProjectSettings,
  findImageModel,
  imageSettingsPatch,
  normalizeImageProjectSettings,
  type ImageProjectSettings,
} from './image-models';
import type {
  ImageHistoryTurn,
  ImageInlineInput,
} from './image-provider';
import { assertSameTenant, requireTenantId, tenantWhere } from '../tenant/tenant.util';

export type ImageUploadFile = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_INLINE_BYTES = 15 * 1024 * 1024;
const MAX_HISTORY_MESSAGES = 16;
const MAX_HISTORY_IMAGES = 8;
const ALLOWED_MIME = new Set<string>(UPLOAD_MIME_TYPES);

const messageInclude = {
  assets: {
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class ImageStudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly geminiImages: GeminiImageProvider,
  ) {}

  async findAll() {
    return this.prisma.imageProject.findMany({
      where: tenantWhere(),
      orderBy: { updatedAt: 'desc' },
      include: {
        assets: {
          where: { kind: 'generated' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: true, assets: true } },
      },
    });
  }

  async findById(id: string) {
    const project = await this.prisma.imageProject.findUnique({
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

  async create(dto: CreateImageProjectDto, userId?: string) {
    const settings = normalizeImageProjectSettings({
      ...defaultImageProjectSettings(),
      ...imageSettingsPatch(dto),
      ...(dto.featureId ? { featureId: dto.featureId } : {}),
      ...(dto.skillRun ? { skillRun: dto.skillRun } : {}),
    });
    const name = dto.name?.trim() || 'Novo projeto';
    return this.prisma.imageProject.create({
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

  async update(id: string, dto: UpdateImageProjectDto) {
    const project = await this.requireProject(id);
    const current = this.settingsOf(project.settings);
    const nextSettings = normalizeImageProjectSettings({
      ...current,
      ...imageSettingsPatch(dto),
    });

    const data: Prisma.ImageProjectUpdateInput = {
      settings: nextSettings as unknown as Prisma.InputJsonValue,
    };
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Informe o nome do projeto');
      data.name = name;
    }

    const updated = await this.prisma.imageProject.update({
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
    const existing = await this.prisma.imageProject.findUnique({
      where: { id },
      select: { id: true, name: true, tenantId: true },
    });
    if (!existing) {
      throw new NotFoundException(`Projeto ${id} não encontrado`);
    }
    assertSameTenant(existing, `Projeto ${id} não encontrado`);
    await this.prisma.imageProject.delete({ where: { id } });
    await this.storage.removeImageProjectDir(id);
    return { id: existing.id, name: existing.name, deleted: true };
  }

  async listMessages(id: string) {
    await this.requireProject(id);
    return this.prisma.imageMessage.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
      include: messageInclude,
    });
  }

  async gallery(id: string) {
    await this.requireProject(id);
    return this.prisma.imageAsset.findMany({
      where: { projectId: id, kind: 'generated' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async library() {
    const projects = await this.prisma.imageProject.findMany({
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

  async addReferences(projectId: string, files: ImageUploadFile[]) {
    await this.requireProject(projectId);
    if (!files.length) {
      throw new BadRequestException('Envie ao menos uma imagem');
    }
    const created: ImageAsset[] = [];
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
      const saved = await this.storage.saveImageProjectAsset(
        projectId,
        buffer,
        file.originalname || 'upload',
        mime,
        'ref',
      );
      created.push(
        await this.prisma.imageAsset.create({
          data: {
            projectId,
            kind: 'reference',
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
    const asset = await this.prisma.imageAsset.findFirst({
      where: { id: assetId, projectId },
    });
    if (!asset) {
      throw new NotFoundException(`Imagem ${assetId} não encontrada`);
    }
    await this.storage.removeImageFile(asset.localPath);
    await this.prisma.imageAsset.delete({ where: { id: asset.id } });
    await this.touch(projectId);
    return { id: asset.id, deleted: true };
  }

  async generate(projectId: string, dto: GenerateImageDto) {
    const project = await this.requireProject(projectId);
    const prompt = dto.prompt.trim();
    if (!prompt) {
      throw new BadRequestException('Informe um prompt');
    }

    const settings = normalizeImageProjectSettings({
      ...this.settingsOf(project.settings),
      ...imageSettingsPatch(dto),
    });

    const model = findImageModel(settings.model);
    if (!model) {
      throw new BadRequestException(`Modelo não suportado: ${settings.model}`);
    }

    const referenceIds = [...new Set(dto.referenceAssetIds || [])];
    if (referenceIds.length > model.capabilities.maxReferences) {
      throw new BadRequestException(
        `Este modelo aceita no máximo ${model.capabilities.maxReferences} referências`,
      );
    }

    const referenceImages = await this.loadInlineAssets(
      projectId,
      referenceIds,
    );
    const history = await this.buildHistory(projectId);

    if (model.provider !== 'gemini') {
      throw new BadRequestException(`Provider não suportado: ${model.provider}`);
    }

    let result;
    try {
      result = await this.geminiImages.generate({
        model: settings.model,
        prompt,
        history,
        referenceImages,
        settings,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha ao gerar imagem';
      throw new BadGatewayException(message);
    }

    const userMessage = await this.prisma.imageMessage.create({
      data: {
        projectId,
        role: 'user',
        kind: 'generation',
        text: prompt,
        settings: settings as unknown as Prisma.InputJsonValue,
      },
    });

    if (referenceIds.length) {
      await this.prisma.imageAsset.updateMany({
        where: { id: { in: referenceIds }, projectId },
        data: { messageId: userMessage.id },
      });
    }

    const modelMessage = await this.prisma.imageMessage.create({
      data: {
        projectId,
        role: 'model',
        kind: 'generation',
        text: result.text || null,
        thoughts: result.thoughts || null,
        model: settings.model,
        settings: settings as unknown as Prisma.InputJsonValue,
        usage: result.usage
          ? (result.usage as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    const generatedAssets: ImageAsset[] = [];
    for (const [index, image] of result.images.entries()) {
      const saved = await this.storage.saveImageProjectAsset(
        projectId,
        image.buffer,
        `generated-${index + 1}`,
        image.mimeType,
        'gen',
      );
      generatedAssets.push(
        await this.prisma.imageAsset.create({
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

    await this.prisma.imageProject.update({
      where: { id: projectId },
      data: {
        settings: settings as unknown as Prisma.InputJsonValue,
      },
    });

    const user = await this.prisma.imageMessage.findUniqueOrThrow({
      where: { id: userMessage.id },
      include: messageInclude,
    });
    const assistant = await this.prisma.imageMessage.findUniqueOrThrow({
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

  settingsOf(raw: unknown): ImageProjectSettings {
    return normalizeImageProjectSettings(raw);
  }

  private async requireProject(id: string) {
    const project = await this.prisma.imageProject.findUnique({
      where: { id },
    });
    if (!project) {
      throw new NotFoundException(`Projeto ${id} não encontrado`);
    }
    return assertSameTenant(project, `Projeto ${id} não encontrado`);
  }

  private async touch(projectId: string) {
    await this.prisma.imageProject.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });
  }

  private async buildHistory(projectId: string): Promise<ImageHistoryTurn[]> {
    const messages = await this.prisma.imageMessage.findMany({
      where: { projectId, kind: 'generation' },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES,
      include: {
        assets: {
          where: { kind: 'generated' },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const chronological = [...messages].reverse();
    const turns: ImageHistoryTurn[] = [];
    let imagesUsed = 0;

    for (const message of chronological) {
      const role = message.role === 'model' ? 'model' : 'user';
      const images: ImageInlineInput[] = [];
      if (role === 'model') {
        for (const asset of message.assets) {
          if (imagesUsed >= MAX_HISTORY_IMAGES) break;
          const inline = await this.fileToInline(asset.localPath, asset.mimeType);
          if (!inline) continue;
          images.push(inline);
          imagesUsed += 1;
        }
      }
      turns.push({
        role,
        text: message.text || undefined,
        images,
      });
    }
    return turns;
  }

  private async loadInlineAssets(
    projectId: string,
    ids: string[],
  ): Promise<ImageInlineInput[]> {
    if (!ids.length) return [];
    const assets = await this.prisma.imageAsset.findMany({
      where: { projectId, id: { in: ids } },
    });
    if (assets.length !== ids.length) {
      throw new BadRequestException('Referência inválida para este projeto');
    }
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const images: ImageInlineInput[] = [];
    for (const id of ids) {
      const asset = byId.get(id);
      if (!asset) continue;
      const inline = await this.fileToInline(asset.localPath, asset.mimeType);
      if (!inline) {
        throw new BadRequestException(
          `Não foi possível ler a referência ${asset.filename}`,
        );
      }
      images.push(inline);
    }
    return images;
  }

  private async fileToInline(
    localPath: string,
    mimeType: string | null,
  ): Promise<ImageInlineInput | null> {
    const buffer = await this.storage.readStorageFile(localPath);
    if (!buffer?.length || buffer.length > MAX_INLINE_BYTES) return null;
    return {
      mimeType: mimeType || 'image/png',
      data: buffer.toString('base64'),
    };
  }

  private async readUploadBuffer(file: ImageUploadFile): Promise<Buffer> {
    if (file.buffer && file.buffer.length) return file.buffer;
    if (file.path) return fs.readFile(file.path);
    return Buffer.alloc(0);
  }
}
