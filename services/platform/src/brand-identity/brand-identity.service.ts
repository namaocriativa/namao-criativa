import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerWhere } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  parseBrandIdentity,
  type BrandIdentity,
} from './brand-identity.contract';
import type { UpdateBrandIdentityDto } from './dto/update-brand-identity.dto';

export type BrandLogoFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class BrandIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: OwnerLookup,
    private readonly storage: StorageService,
  ) {}

  async get(ownerId: string): Promise<BrandIdentity> {
    const profile = await this.owners.requireProfile(ownerId);
    return parseBrandIdentity(
      await this.readRaw(profile.kind, profile.id),
    );
  }

  async put(ownerId: string, dto: UpdateBrandIdentityDto): Promise<BrandIdentity> {
    const profile = await this.owners.requireProfile(ownerId);
    const next = this.mergeDto(dto);
    if (next.logoImageId) {
      await this.requireOwnerImage(ownerId, next.logoImageId);
    }
    await this.writeRaw(profile.kind, profile.id, next);
    return next;
  }

  async resolveLogoFile(
    ownerId: string,
    logoImageId?: string | null,
  ): Promise<BrandLogoFile | null> {
    const id = String(logoImageId || '').trim();
    if (!id) return null;
    const image = await this.requireOwnerImage(ownerId, id);
    const localPath = String(image.localPath || '').trim();
    if (!localPath) return null;
    const buffer = await this.storage.readStorageFile(localPath);
    if (!buffer?.length) {
      throw new BadRequestException('Não foi possível ler o arquivo do logo');
    }
    const mime = (image.mimeType || 'image/png').split(';')[0].trim() || 'image/png';
    return {
      buffer,
      originalname: image.filename || 'brand-logo.png',
      mimetype: mime,
      size: buffer.length,
    };
  }

  private mergeDto(dto: UpdateBrandIdentityDto): BrandIdentity {
    const next: BrandIdentity = {};
    const logoImageId = optionalText(dto.logoImageId, 64);
    if (logoImageId) next.logoImageId = logoImageId;
    const primaryColor = optionalHex(dto.primaryColor);
    if (primaryColor) next.primaryColor = primaryColor;
    const secondaryColor = optionalHex(dto.secondaryColor);
    if (secondaryColor) next.secondaryColor = secondaryColor;
    const accentColor = optionalHex(dto.accentColor);
    if (accentColor) next.accentColor = accentColor;
    const backgroundColor = optionalHex(dto.backgroundColor);
    if (backgroundColor) next.backgroundColor = backgroundColor;
    const headingFont = optionalText(dto.headingFont, 80);
    if (headingFont) next.headingFont = headingFont;
    const bodyFont = optionalText(dto.bodyFont, 80);
    if (bodyFont) next.bodyFont = bodyFont;
    const voice = optionalText(dto.voice, 240);
    if (voice) next.voice = voice;
    const logoAppearance = optionalText(dto.logoAppearance, 400);
    if (logoAppearance) next.logoAppearance = logoAppearance;
    return next;
  }

  private async requireOwnerImage(ownerId: string, imageId: string) {
    const image = await this.prisma.leadImage.findFirst({
      where: {
        id: imageId,
        ...ownerWhere(ownerId),
      },
    });
    if (!image) {
      throw new BadRequestException('logoImageId não pertence a este perfil');
    }
    return image;
  }

  private async readRaw(kind: 'lead' | 'customer', id: string) {
    if (kind === 'lead') {
      const row = await this.prisma.lead.findUnique({
        where: { id },
        select: { brandIdentity: true },
      });
      if (!row) throw new NotFoundException('Lead não encontrado');
      return row.brandIdentity;
    }
    const row = await this.prisma.customer.findUnique({
      where: { id },
      select: { brandIdentity: true },
    });
    if (!row) throw new NotFoundException('Cliente não encontrado');
    return row.brandIdentity;
  }

  private async writeRaw(
    kind: 'lead' | 'customer',
    id: string,
    identity: BrandIdentity,
  ) {
    const data = {
      brandIdentity:
        Object.keys(identity).length > 0
          ? (identity as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    };
    if (kind === 'lead') {
      await this.prisma.lead.update({ where: { id }, data });
      return;
    }
    await this.prisma.customer.update({ where: { id }, data });
  }
}

function optionalText(value: string | null | undefined, max: number): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.slice(0, max);
}

function optionalHex(value: string | null | undefined): string | undefined {
  const text = optionalText(value, 7);
  if (!text) return undefined;
  if (!/^#([0-9a-fA-F]{6})$/.test(text)) {
    throw new BadRequestException('Cor deve ser #RRGGBB');
  }
  return text.toUpperCase();
}
