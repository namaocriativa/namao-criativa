import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as fs from 'fs/promises';
import { UpdateLeadDto } from '../lead/dto/update-lead.dto';
import { type LeadUploadFile } from '../lead/lead.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  StorageService,
  UPLOAD_MIME_TYPES,
} from '../storage/storage.service';
import { PROFILE_DETAIL_INCLUDE, PROFILE_LIST_INCLUDE } from '../owner/owner.util';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const ALLOWED_MIME = new Set<string>(UPLOAD_MIME_TYPES);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async findAll() {
    return this.prisma.customer.findMany({
      orderBy: { updatedAt: 'desc' },
      include: PROFILE_LIST_INCLUDE,
      omit: { generateConfig: true },
    });
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: PROFILE_DETAIL_INCLUDE,
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  async deleteById(id: string) {
    const existing = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    await this.prisma.customer.delete({ where: { id } });
    await this.storageService.removeLeadDir(id);
    return { id: existing.id, name: existing.name, deleted: true };
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.findById(id);
    const data: Prisma.CustomerUpdateInput = {};
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.instagram !== undefined) data.instagram = dto.instagram;
    if (Object.keys(data).length) {
      await this.prisma.customer.update({ where: { id }, data });
    }
    return this.findById(id);
  }

  async addImages(customerId: string, files: LeadUploadFile[]) {
    await this.findById(customerId);
    if (!files.length) {
      throw new BadRequestException('Envie ao menos uma imagem');
    }
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
      const saved = await this.storageService.saveUploadedImage(
        customerId,
        buffer,
        file.originalname || 'upload',
        mime,
      );
      await this.prisma.leadImage.create({
        data: {
          customerId,
          source: 'upload',
          sourceUrl: saved.sourceUrl,
          localPath: saved.localPath,
          filename: saved.filename,
          mimeType: saved.mimeType,
          width: saved.width,
          height: saved.height,
        },
      });
    }
    return this.findById(customerId);
  }

  async addVideo(
    customerId: string,
    file: LeadUploadFile | undefined,
    slotRaw: string,
  ) {
    await this.findById(customerId);
    const slot =
      slotRaw === 'portrait'
        ? 'portrait'
        : slotRaw === 'background'
          ? 'background'
          : null;
    if (!slot) {
      throw new BadRequestException('Informe o slot background ou portrait');
    }
    if (!file) {
      throw new BadRequestException('Envie um arquivo de vídeo');
    }
    const mime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
    if (!VIDEO_MIME.has(mime)) {
      throw new BadRequestException(
        `Tipo de vídeo não permitido: ${file.originalname || mime || 'arquivo'}`,
      );
    }
    if ((file.size ?? file.buffer?.length ?? 0) > MAX_VIDEO_BYTES) {
      throw new BadRequestException(
        `Vídeo grande demais: ${file.originalname || 'vídeo'}`,
      );
    }
    const buffer = await this.readUploadBuffer(file);
    if (!buffer.length) {
      throw new BadRequestException('Arquivo vazio');
    }
    const saved = await this.storageService.saveUploadedVideo(
      customerId,
      buffer,
      file.originalname || `hero-${slot}.mp4`,
      mime,
      slot,
    );
    return {
      slot,
      filename: saved.filename,
      publicPath: `/videos/${saved.filename}`,
    };
  }

  async listVideos(customerId: string) {
    await this.findById(customerId);
    const files = await this.storageService.listLeadVideos(customerId);
    return {
      videos: files.map((item) => ({
        filename: item.filename,
        publicPath: `/videos/${item.filename}`,
        localPath: item.localPath,
        slot: item.filename.includes('portrait')
          ? 'portrait'
          : item.filename.includes('background')
            ? 'background'
            : undefined,
      })),
    };
  }

  async deleteImage(customerId: string, imageId: string) {
    const image = await this.prisma.leadImage.findFirst({
      where: { id: imageId, customerId },
    });
    if (!image) {
      throw new NotFoundException(`Imagem ${imageId} não encontrada`);
    }
    await this.storageService.removeImageFile(image.localPath);
    await this.prisma.leadImage.delete({ where: { id: image.id } });
    return this.findById(customerId);
  }

  private async readUploadBuffer(file: LeadUploadFile): Promise<Buffer> {
    if (file.buffer && file.buffer.length) return file.buffer;
    if (file.path) return fs.readFile(file.path);
    return Buffer.alloc(0);
  }
}
