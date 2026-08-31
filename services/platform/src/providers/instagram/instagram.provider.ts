import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadProvider } from '../provider.interface';
import { EnrichmentInput, ProviderResult } from '../provider.types';
import { InstagramGraphClient } from '../../instagram/instagram-graph.client';

@Injectable()
export class InstagramProvider implements LeadProvider {
  readonly name = 'instagram';

  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: InstagramGraphClient,
  ) {}

  async enrich(input: EnrichmentInput): Promise<ProviderResult | null> {
    if (!input.instagram) {
      return null;
    }

    const handle = this.normalizeHandle(input.instagram);
    const url = handle.startsWith('http')
      ? handle
      : `https://www.instagram.com/${handle.replace(/^@/, '')}/`;
    const username = this.usernameFrom(handle);

    const result: ProviderResult = {
      provider: this.name,
      sourceUrl: url,
      data: {
        instagram: handle.startsWith('http') ? handle : `@${username}`,
      },
      raw: {
        note: 'URL preservada; mídia só com Instagram Graph autorizado',
        url,
      },
    };

    const conn = await this.prisma.instagramConnection.findFirst({
      where: username
        ? { username }
        : { lead: { instagram: { contains: username || '___none___' } } },
    });
    if (!conn) return result;

    try {
      const media = await this.graph.listMedia({
        igUserId: conn.igUserId,
        accessToken: conn.accessToken,
        limit: 12,
      });
      result.images = media.map((item) => ({
        url: item.url,
        kind: 'photo' as const,
      }));
      result.raw = { url, importedFromGraph: media.length };
    } catch {
      // keep URL-only result
    }

    return result;
  }

  private usernameFrom(value: string): string {
    const normalized = this.normalizeHandle(value);
    if (normalized.startsWith('http')) {
      try {
        return new URL(normalized).pathname.replace(/\//g, '').replace(/^@/, '');
      } catch {
        return normalized.replace(/^@/, '');
      }
    }
    return normalized.replace(/^@/, '');
  }

  private normalizeHandle(value: string): string {
    const trimmed = value.trim();
    if (trimmed.startsWith('http')) {
      try {
        const pathname = new URL(trimmed).pathname.replace(/\//g, '');
        return pathname ? `@${pathname}` : trimmed;
      } catch {
        return trimmed;
      }
    }
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  }
}
