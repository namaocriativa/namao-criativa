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
import { UpdateOfferTemplateDto } from './dto/update-offer-template.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import {
  DEFAULT_OFFER_TEMPLATE,
} from './offer-template';
import { assertSameTenant, requireTenantId, tenantWhere } from '../tenant/tenant.util';

export type PackageUploadFile = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set<string>(UPLOAD_MIME_TYPES);

const ACTIVE_PACKAGE_SELECT = {
  id: true,
  name: true,
  summary: true,
  description: true,
  price: true,
  promoPrice: true,
  currency: true,
  benefits: true,
  status: true,
} as const;

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findAll() {
    return this.prisma.package.findMany({
      where: tenantWhere(),
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

  async findActive() {
    return this.prisma.package.findMany({
      where: tenantWhere({ status: 'active' }),
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: ACTIVE_PACKAGE_SELECT,
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
    return assertSameTenant(pkg, `Pacote ${id} não encontrado`);
  }

  async requireActive(id: string) {
    if (!id?.trim()) {
      throw new BadRequestException(
        'Selecione um pacote para enviar a proposta.',
      );
    }
    const pkg = await this.findById(id.trim());
    if (pkg.status !== 'active') {
      throw new BadRequestException(
        'Selecione um pacote ativo para enviar a proposta.',
      );
    }
    return pkg;
  }

  async create(dto: CreatePackageDto) {
    this.assertPromoPrice(dto.price ?? null, dto.promoPrice ?? null);
    const sortOrder = await this.nextSortOrder();
    return this.prisma.package.create({
      data: {
        tenantId: requireTenantId(),
        name: dto.name.trim(),
        summary: dto.summary?.trim() || null,
        description: dto.description?.trim() || null,
        price: dto.price ?? null,
        promoPrice: dto.promoPrice ?? null,
        currency: dto.currency?.trim() || 'BRL',
        benefits:
          dto.benefits !== undefined
            ? this.normalizeBenefits(dto.benefits)
            : [],
        status: dto.status || 'draft',
        sortOrder,
      },
      include: {
        images: true,
      },
    });
  }

  async update(id: string, dto: UpdatePackageDto) {
    const existing = await this.findById(id);
    const nextPrice = dto.price !== undefined ? dto.price : existing.price;
    const nextPromo =
      dto.promoPrice !== undefined ? dto.promoPrice : existing.promoPrice;
    this.assertPromoPrice(nextPrice, nextPromo);

    const data: Prisma.PackageUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.summary !== undefined) {
      data.summary = dto.summary?.trim() || null;
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.promoPrice !== undefined) data.promoPrice = dto.promoPrice;
    if (dto.currency !== undefined) {
      data.currency = dto.currency.trim() || 'BRL';
    }
    if (dto.benefits !== undefined) {
      data.benefits = this.normalizeBenefits(dto.benefits);
    }
    if (dto.status !== undefined) data.status = dto.status;

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
      select: { id: true, name: true, tenantId: true },
    });

    if (!existing) {
      throw new NotFoundException(`Pacote ${id} não encontrado`);
    }
    assertSameTenant(existing, `Pacote ${id} não encontrado`);

    await this.prisma.package.delete({ where: { id } });
    await this.storageService.removePackageDir(id);

    return { id: existing.id, name: existing.name, deleted: true };
  }

  async getOfferTemplate() {
    const tenantId = requireTenantId();
    return this.prisma.offerTemplate.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        ...DEFAULT_OFFER_TEMPLATE,
      },
    });
  }

  async updateOfferTemplate(dto: UpdateOfferTemplateDto) {
    const current = await this.getOfferTemplate();
    return this.prisma.offerTemplate.update({
      where: { id: current.id },
      data: {
        emailSubject:
          dto.emailSubject !== undefined
            ? dto.emailSubject.trim()
            : current.emailSubject,
        emailBody:
          dto.emailBody !== undefined ? dto.emailBody.trim() : current.emailBody,
        whatsappMessage:
          dto.whatsappMessage !== undefined
            ? dto.whatsappMessage.trim()
            : current.whatsappMessage,
      },
    });
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

  assertPromoPrice(
    price: number | null | undefined,
    promoPrice: number | null | undefined,
  ) {
    if (promoPrice == null) return;
    if (price == null || !Number.isFinite(Number(price))) {
      throw new BadRequestException(
        'Preço promocional exige um preço cheio.',
      );
    }
    if (!(Number(promoPrice) < Number(price))) {
      throw new BadRequestException(
        'Preço promocional deve ser menor que o preço.',
      );
    }
  }

  private async nextSortOrder() {
    const last = await this.prisma.package.aggregate({
      where: tenantWhere(),
      _max: { sortOrder: true },
    });
    return (last._max.sortOrder ?? -1) + 1;
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
