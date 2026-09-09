import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerCreateData } from '../owner/owner.util';
import {
  CHAT_CHANNEL_LANDING,
  CHAT_CHANNEL_NAMAO,
  hashIp,
  newSessionId,
  newSessionToken,
  SESSION_TTL_MS,
  sha256,
} from './chat-crypto';

@Injectable()
export class ChatSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly owners: OwnerLookup,
  ) {}

  async create(opts: {
    siteId: string;
    ip: string;
    origin?: string;
  }) {
    const lead = await this.owners.findByPublicSiteId(opts.siteId);
    if (!lead?.chatEnabled || !lead.publicSiteId) {
      throw new NotFoundException('Chat indisponível');
    }

    const token = newSessionToken();
    const sessionId = newSessionId();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.prisma.chatSession.create({
      data: {
        id: sessionId,
        ...ownerCreateData(lead.kind, lead.id),
        tokenHash: sha256(token),
        expiresAt,
        ipHash: hashIp(opts.ip),
        origin: opts.origin || null,
        status: 'active',
        channel: CHAT_CHANNEL_LANDING,
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
    });
    if (!session) throw new UnauthorizedException('Sessão inválida');
    if (session.channel === CHAT_CHANNEL_NAMAO) {
      throw new UnauthorizedException('Sessão inválida');
    }
    if (session.status !== 'active' || session.expiresAt.getTime() <= Date.now()) {
      if (session.status === 'active') {
        await this.prisma.chatSession.update({
          where: { id: session.id },
          data: { status: 'expired' },
        });
      }
      throw new UnauthorizedException('Sessão expirada');
    }
    const ownerId = session.customerId || session.leadId;
    if (!ownerId) throw new UnauthorizedException('Sessão inválida');
    const lead = await this.owners.requireProfile(ownerId);
    if (!lead.chatEnabled) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return {
      ...session,
      leadId: lead.id,
      lead: {
        id: lead.id,
        chatEnabled: lead.chatEnabled,
        publicSiteId: lead.publicSiteId,
        publishedOrigin: lead.publishedOrigin,
        landingSlug: lead.landingSlug,
      },
    };
  }
}
