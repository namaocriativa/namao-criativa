import { Injectable, NotFoundException } from '@nestjs/common';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertSameTenant } from '../tenant/tenant.util';
import type { UpdateProfileCharacterDto } from './dto/update-profile-character.dto';

const characterInclude = {
  assets: { orderBy: { createdAt: 'asc' as const } },
} as const;

@Injectable()
export class ProfileCharacterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: OwnerLookup,
  ) {}

  async get(ownerId: string) {
    const profile = await this.owners.requireProfile(ownerId);
    const characterId = await this.readCharacterId(profile.kind, profile.id);
    if (!characterId) {
      return { characterId: null, character: null };
    }
    const character = await this.prisma.creativeCharacter.findUnique({
      where: { id: characterId },
      include: characterInclude,
    });
    if (!character) {
      return { characterId: null, character: null };
    }
    try {
      assertSameTenant(character);
    } catch {
      return { characterId: null, character: null };
    }
    return { characterId: character.id, character };
  }

  async put(ownerId: string, dto: UpdateProfileCharacterDto) {
    const profile = await this.owners.requireProfile(ownerId);
    const nextId = this.normalizeCharacterId(dto.characterId);
    if (nextId) {
      const character = await this.prisma.creativeCharacter.findUnique({
        where: { id: nextId },
        include: characterInclude,
      });
      if (!character) {
        throw new NotFoundException(`Personagem ${nextId} não encontrado`);
      }
      assertSameTenant(character, `Personagem ${nextId} não encontrado`);
      await this.writeCharacterId(profile.kind, profile.id, character.id);
      return { characterId: character.id, character };
    }
    await this.writeCharacterId(profile.kind, profile.id, null);
    return { characterId: null, character: null };
  }

  private normalizeCharacterId(value: string | null | undefined): string | null {
    if (value == null) return null;
    const id = String(value).trim();
    return id || null;
  }

  private async readCharacterId(
    kind: 'lead' | 'customer',
    id: string,
  ): Promise<string | null> {
    if (kind === 'lead') {
      const row = await this.prisma.lead.findUnique({
        where: { id },
        select: { characterId: true },
      });
      if (!row) throw new NotFoundException('Lead não encontrado');
      return row.characterId;
    }
    const row = await this.prisma.customer.findUnique({
      where: { id },
      select: { characterId: true },
    });
    if (!row) throw new NotFoundException('Cliente não encontrado');
    return row.characterId;
  }

  private async writeCharacterId(
    kind: 'lead' | 'customer',
    id: string,
    characterId: string | null,
  ) {
    if (kind === 'lead') {
      await this.prisma.lead.update({
        where: { id },
        data: { characterId },
      });
      return;
    }
    await this.prisma.customer.update({
      where: { id },
      data: { characterId },
    });
  }
}
