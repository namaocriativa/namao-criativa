import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  hashIp,
  newSessionId,
  newSessionToken,
  SESSION_TTL_MS,
  sha256,
} from './chat-crypto';

@Injectable()
export class ChatSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(opts: {
    siteId: string;
    ip: string;
    origin?: string;
  }) {
    const lead = await this.prisma.lead.findUnique({
      where: { publicSiteId: opts.siteId },
      select: {
        id: true,
        chatEnabled: true,
        publicSiteId: true,
      },
    });
    if (!lead?.chatEnabled || !lead.publicSiteId) {
      throw new NotFoundException('Chat indisponível');
    }

    const token = newSessionToken();
    const sessionId = newSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.chatSession.create({
      data: {
        id: sessionId,
        leadId: lead.id,
        tokenHash: sha256(token),
        expiresAt,
        ipHash: hashIp(opts.ip),
        origin: opts.origin || null,
        status: 'active',
      },
    });

    return {
      sessionId,
      sessionToken: token,
      expiresAt: expiresAt.toISOString(),
      leadId: lead.id,
      siteId: lead.publicSiteId,
    };
  }

  async resolve(token: string) {
    const raw = String(token || '').trim();
    if (!raw) throw new UnauthorizedException('Sessão inválida');
    const session = await this.prisma.chatSession.findUnique({
      where: { tokenHash: sha256(raw) },
      include: {
        lead: {
          select: {
            id: true,
            chatEnabled: true,
            publicSiteId: true,
            publishedOrigin: true,
            landingSlug: true,
          },
        },
      },
    });
    if (!session) throw new UnauthorizedException('Sessão inválida');
    if (session.status !== 'active' || session.expiresAt.getTime() <= Date.now()) {
      if (session.status === 'active') {
        await this.prisma.chatSession.update({
          where: { id: session.id },
          data: { status: 'expired' },
        });
      }
      throw new UnauthorizedException('Sessão expirada');
    }
    if (!session.lead.chatEnabled) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return session;
  }
}
