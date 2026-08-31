import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import {
  StorageService,
  UPLOAD_MIME_TYPES,
} from '../storage/storage.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

export type PackageUploadFile = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set<string>(UPLOAD_MIME_TYPES);

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findAll() {
    return this.prisma.package.findMany({
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      include: {
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 1,
        },
        _count: { select: { images: true } },
      },
    });
  }

  async findById(id: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException(`Pacote ${id} não encontrado`);
    }

    return pkg;
  }

  async create(dto: CreatePackageDto) {
    return this.prisma.package.create({
      data: {
        name: dto.name.trim(),
        summary: dto.summary?.trim() || null,
        description: dto.description?.trim() || null,
        price: dto.price ?? null,
        currency: dto.currency?.trim() || 'BRL',
        benefits:
          dto.benefits !== undefined
            ? this.normalizeBenefits(dto.benefits)
            : [],
        whatsappMessage: dto.whatsappMessage?.trim() || null,
        emailSubject: dto.emailSubject?.trim() || null,
        emailBody: dto.emailBody?.trim() || null,
        status: dto.status || 'draft',
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        images: true,
      },
    });
  }

  async update(id: string, dto: UpdatePackageDto) {
    await this.findById(id);

    const data: Prisma.PackageUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.summary !== undefined) {
      data.summary = dto.summary?.trim() || null;
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.currency !== undefined) {
      data.currency = dto.currency.trim() || 'BRL';
    }
    if (dto.benefits !== undefined) {
      data.benefits = this.normalizeBenefits(dto.benefits);
    }
    if (dto.whatsappMessage !== undefined) {
      data.whatsappMessage = dto.whatsappMessage?.trim() || null;
    }
    if (dto.emailSubject !== undefined) {
      data.emailSubject = dto.emailSubject?.trim() || null;
    }
    if (dto.emailBody !== undefined) {
      data.emailBody = dto.emailBody?.trim() || null;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return this.prisma.package.update({
      where: { id },
      data,
      include: {
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async deleteById(id: string) {
    const existing = await this.prisma.package.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      throw new NotFoundException(`Pacote ${id} não encontrado`);
    }

    await this.prisma.package.delete({ where: { id } });
    await this.storageService.removePackageDir(id);

    return { id: existing.id, name: existing.name, deleted: true };
  }

  async addImages(packageId: string, files: PackageUploadFile[]) {
    await this.findById(packageId);
    if (!files.length) {
      throw new BadRequestException('Envie ao menos uma imagem');
    }

    const currentCount = await this.prisma.packageImage.count({
      where: { packageId },
    });

    let nextOrder = currentCount;
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
      const saved = await this.storageService.saveUploadedPackageImage(
        packageId,
        buffer,
        file.originalname || 'upload',
        mime,
      );
      await this.prisma.packageImage.create({
        data: {
          packageId,
          sourceUrl: saved.sourceUrl,
          localPath: saved.localPath,
          filename: saved.filename,
          mimeType: saved.mimeType,
          sortOrder: nextOrder++,
        },
      });
    }

    return this.findById(packageId);
  }

  async deleteImage(packageId: string, imageId: string) {
    const image = await this.prisma.packageImage.findFirst({
      where: { id: imageId, packageId },
    });
    if (!image) {
      throw new NotFoundException(`Imagem ${imageId} não encontrada`);
    }

    await this.storageService.removeImageFile(image.localPath);
    await this.prisma.packageImage.delete({ where: { id: image.id } });
    return this.findById(packageId);
  }

  private normalizeBenefits(
    benefits: string[] | null | undefined,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (benefits === null) return Prisma.JsonNull;
    if (benefits === undefined) return Prisma.JsonNull;
    const cleaned = benefits
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return cleaned;
  }

  private async readUploadBuffer(file: PackageUploadFile): Promise<Buffer> {
    if (file.buffer && file.buffer.length) return file.buffer;
    if (file.path) return fs.readFile(file.path);
    return Buffer.alloc(0);
  }
}
