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
import { UpdateLeadDto } from './dto/update-lead.dto';
import type { JwtUser } from '../auth/jwt.strategy';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import { STUDIO_CREATOR_SELECT, withPortalUsers } from '../owner/owner.util';
import { assertSameTenant, tenantWhere } from '../tenant/tenant.util';

export type LeadUploadFile = {
  buffer?: Buffer;
  path?: string;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const ALLOWED_MIME = new Set<string>(UPLOAD_MIME_TYPES);
const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

@Injectable()
export class LeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly access: StudioLeadAccessService,
  ) {}

  async findAll(actor: JwtUser) {
    const leads = await this.prisma.lead.findMany({
      where: { AND: [tenantWhere(), this.access.visibleWhere(actor)] },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            images: true,
            sources: true,
          },
        },
        createdBy: { select: STUDIO_CREATOR_SELECT },
        studioShares: { select: { userId: true } },
      },
      omit: { generateConfig: true },
    });
    return leads.map((lead) => this.access.present(actor, lead));
  }

  async findById(id: string, actor?: JwtUser) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { createdAt: 'asc' },
        },
        sources: {
          orderBy: { createdAt: 'asc' },
        },
        createdBy: { select: STUDIO_CREATOR_SELECT },
        studioShares: { select: { userId: true } },
        clientAccounts: {
          select: { id: true, email: true, name: true, createdAt: true },
        },
        invites: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            phone: true,
            expiresAt: true,
            createdAt: true,
          },
        },
        instagramConnections: {
          select: {
            id: true,
            username: true,
            igUserId: true,
            tokenExpiresAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }
    assertSameTenant(lead, `Lead ${id} not found`);

    if (actor) {
      return withPortalUsers(this.access.present(actor, lead));
    }
    return withPortalUsers(lead);
  }

  async deleteById(id: string) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
      select: { id: true, name: true, tenantId: true },
    });

    if (!existing) {
      throw new NotFoundException(`Lead ${id} not found`);
    }
    assertSameTenant(existing, `Lead ${id} not found`);

    await this.prisma.lead.delete({ where: { id } });
    await this.storageService.removeLeadDir(id);

    return { id: existing.id, name: existing.name, deleted: true };
  }

  async update(id: string, dto: UpdateLeadDto, actor?: JwtUser) {
    await this.findById(id);

    const data: Prisma.LeadUpdateInput = {};
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.instagram !== undefined) data.instagram = dto.instagram;

    if (Object.keys(data).length) {
      await this.prisma.lead.update({ where: { id }, data });
    }

    return this.findById(id, actor);
  }

  async addImages(leadId: string, files: LeadUploadFile[], actor?: JwtUser) {
    await this.findById(leadId);
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
        leadId,
        buffer,
        file.originalname || 'upload',
        mime,
      );
      await this.prisma.leadImage.create({
        data: {
          leadId,
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

    return this.findById(leadId, actor);
  }

  async addVideo(
    leadId: string,
    file: LeadUploadFile | undefined,
    slotRaw: string,
  ) {
    await this.findById(leadId);
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
      leadId,
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

  async listVideos(leadId: string) {
    await this.findById(leadId);
    const files = await this.storageService.listLeadVideos(leadId);
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

  async deleteImage(leadId: string, imageId: string, actor?: JwtUser) {
    const image = await this.prisma.leadImage.findFirst({
      where: { id: imageId, leadId },
    });
    if (!image) {
      throw new NotFoundException(`Imagem ${imageId} não encontrada`);
    }

    await this.storageService.removeImageFile(image.localPath);
    await this.prisma.leadImage.delete({ where: { id: image.id } });
    return this.findById(leadId, actor);
  }

  private async readUploadBuffer(file: LeadUploadFile): Promise<Buffer> {
    if (file.buffer && file.buffer.length) return file.buffer;
    if (file.path) return fs.readFile(file.path);
    return Buffer.alloc(0);
  }
}
