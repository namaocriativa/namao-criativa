import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import type { JwtUser } from '../auth/jwt.strategy';
import { isStudioRole } from '../auth/roles';
import { InstagramGraphClient } from './instagram-graph.client';
import { OwnerLookup } from '../owner/owner-lookup.service';
import {
  jwtOwnerId,
  ownerCreateData,
  ownerWhere,
} from '../owner/owner.util';

@Injectable()
export class InstagramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: InstagramGraphClient,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly owners: OwnerLookup,
  ) {}

  statusConfigured() {
    return {
      configured: this.graph.configured(),
      redirectUri: this.graph.redirectUri,
    };
  }

  async startUrl(user: JwtUser): Promise<string> {
    if (!this.graph.configured()) {
      throw new BadRequestException(
        'Instagram Graph API não configurada. Defina META_APP_ID e META_APP_SECRET.',
      );
    }
    if (!jwtOwnerId(user)) {
      throw new BadRequestException(
        'Conta sem lead vinculado. Use um convite para se registrar.',
      );
    }
    const state = this.jwt.sign(
      { purpose: 'ig_oauth', sub: user.id },
      { expiresIn: '10m' },
    );
    return this.graph.oauthUrl(state);
  }

  async handleCallback(code: string | undefined, state: string | undefined) {
    const namao =
      this.config.get<string>('NAMAO_PUBLIC_URL')?.replace(/\/$/, '') ||
      'http://localhost:5174';
    const fail = (reason: string) =>
      `${namao}/conectar.html?ig=error&reason=${encodeURIComponent(reason)}`;

    if (!code || !state) {
      return fail('missing_code');
    }

    let userId: string;
    try {
      const payload = this.jwt.verify<{ purpose?: string; sub?: string }>(state);
      if (payload.purpose !== 'ig_oauth' || !payload.sub) {
        return fail('invalid_state');
      }
      userId = payload.sub;
    } catch {
      return fail('invalid_state');
    }

    const user = await this.prisma.clientAccount.findUnique({
      where: { id: userId },
    });
    const ownerId = user ? jwtOwnerId(user) : null;
    if (!user || !ownerId) {
      return fail('user_without_lead');
    }

    try {
      const tokens = await this.graph.exchangeCode(code);
      const account = await this.graph.findInstagramAccount(tokens.accessToken);
      if (!account) {
        return fail('no_instagram_business_account');
      }

      const kind = await this.owners.requireKind(ownerId);
      const existing = await this.prisma.instagramConnection.findFirst({
        where: ownerWhere(ownerId),
      });
      if (existing) {
        await this.prisma.instagramConnection.update({
          where: { id: existing.id },
          data: {
            clientAccountId: user.id,
            igUserId: account.igUserId,
            username: account.username,
            accessToken: tokens.accessToken,
            tokenExpiresAt: tokens.expiresAt,
          },
        });
      } else {
        await this.prisma.instagramConnection.create({
          data: {
            clientAccountId: user.id,
            ...ownerCreateData(kind, ownerId),
            igUserId: account.igUserId,
            username: account.username,
            accessToken: tokens.accessToken,
            tokenExpiresAt: tokens.expiresAt,
            scopes: 'instagram_basic,pages_show_list',
          },
        });
      }

      if (account.username) {
        await this.owners.update(ownerId, {
          instagram: `https://www.instagram.com/${account.username}/`,
        });
      }

      await this.syncLead(ownerId, {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'CLIENT',
        leadId: user.leadId,
        customerId: user.customerId,
      });
      return `${namao}/conectar.html?ig=ok`;
    } catch {
      return fail('graph_error');
    }
  }

  async connectionForUser(user: JwtUser) {
    const ownerId = jwtOwnerId(user);
    if (!ownerId) return { connected: false as const };
    const conn = await this.prisma.instagramConnection.findFirst({
      where: ownerWhere(ownerId),
      select: {
        id: true,
        igUserId: true,
        username: true,
        tokenExpiresAt: true,
        createdAt: true,
      },
    });
    if (!conn) return { connected: false as const };
    return { connected: true as const, connection: conn };
  }

  async syncLead(leadId: string, user?: JwtUser) {
    if (user && !isStudioRole(user.role) && jwtOwnerId(user) !== leadId) {
      throw new ForbiddenException('Sem permissão para este lead');
    }
    const kind = await this.owners.requireKind(leadId);
    const conn = await this.prisma.instagramConnection.findFirst({
      where: ownerWhere(leadId),
    });
    if (!conn) {
      throw new NotFoundException('Lead sem Instagram autorizado');
    }

    const media = await this.graph.listMedia({
      igUserId: conn.igUserId,
      accessToken: conn.accessToken,
      limit: 12,
    });

    let imported = 0;
    const existingCount = await this.prisma.leadImage.count({
      where: ownerWhere(leadId),
    });
    let index = existingCount + 1;

    for (const item of media) {
      const saved = await this.storage.downloadImage(leadId, item.url, index);
      if (!saved) continue;
      try {
        await this.prisma.leadImage.create({
          data: {
            ...ownerCreateData(kind, leadId),
            source: 'instagram',
            sourceUrl: saved.sourceUrl,
            localPath: saved.localPath,
            filename: saved.filename,
            mimeType: saved.mimeType,
            width: saved.width,
            height: saved.height,
          },
        });
        imported += 1;
        index += 1;
      } catch {
        // unique owner+sourceUrl
      }
    }

    return {
      leadId,
      username: conn.username,
      found: media.length,
      imported,
    };
  }
}
