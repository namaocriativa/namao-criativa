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
import { InstagramGraphClient } from './instagram-graph.client';

@Injectable()
export class InstagramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly graph: InstagramGraphClient,
    private readonly jwt: JwtService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
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
    if (!user.leadId) {
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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.leadId) {
      return fail('user_without_lead');
    }

    try {
      const tokens = await this.graph.exchangeCode(code);
      const account = await this.graph.findInstagramAccount(tokens.accessToken);
      if (!account) {
        return fail('no_instagram_business_account');
      }

      await this.prisma.instagramConnection.upsert({
        where: { leadId: user.leadId },
        create: {
          userId: user.id,
          leadId: user.leadId,
          igUserId: account.igUserId,
          username: account.username,
          accessToken: tokens.accessToken,
          tokenExpiresAt: tokens.expiresAt,
          scopes: 'instagram_basic,pages_show_list',
        },
        update: {
          userId: user.id,
          igUserId: account.igUserId,
          username: account.username,
          accessToken: tokens.accessToken,
          tokenExpiresAt: tokens.expiresAt,
        },
      });

      if (account.username) {
        await this.prisma.lead.update({
          where: { id: user.leadId },
          data: {
            instagram: `https://www.instagram.com/${account.username}/`,
          },
        });
      }

      await this.syncLead(user.leadId, user);
      return `${namao}/conectar.html?ig=ok`;
    } catch {
      return fail('graph_error');
    }
  }

  async connectionForUser(user: JwtUser) {
    if (!user.leadId) return { connected: false as const };
    const conn = await this.prisma.instagramConnection.findUnique({
      where: { leadId: user.leadId },
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
    if (user && user.role !== 'ADMIN' && user.leadId !== leadId) {
      throw new ForbiddenException('Sem permissão para este lead');
    }
    const conn = await this.prisma.instagramConnection.findUnique({
      where: { leadId },
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
    const existingCount = await this.prisma.leadImage.count({ where: { leadId } });
    let index = existingCount + 1;

    for (const item of media) {
      const saved = await this.storage.downloadImage(leadId, item.url, index);
      if (!saved) continue;
      try {
        await this.prisma.leadImage.create({
          data: {
            leadId,
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
        // unique leadId+sourceUrl
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
