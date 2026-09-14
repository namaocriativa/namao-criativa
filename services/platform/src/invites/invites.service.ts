import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { EvolutionClient } from '../evolution/evolution.client';
import {
  isSendableEmail,
  normalizeEmail,
  publicLoginUrl,
} from '../lead-account/lead-account.util';
import { MailService } from '../mail/mail.service';
import { namaoWhatsAppUrl } from '../mail/site-introduction-email';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerCreateData } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly evolution: EvolutionClient,
    private readonly mail: MailService,
    private readonly owners: OwnerLookup,
  ) {}

  publicBaseUrl(): string {
    return (
      this.config.get<string>('NAMAO_PUBLIC_URL')?.replace(/\/$/, '') ||
      'http://localhost:5174'
    );
  }

  registerUrl(token: string): string {
    return `${this.publicBaseUrl()}/register.html?invite=${encodeURIComponent(token)}`;
  }

  buildWhatsAppMessage(opts: { leadName: string; registerUrl: string }): string {
    return [
      `Olá, ${opts.leadName}.`,
      '',
      'Somos a Namão Criativa. Gostaríamos de criar uma presença digital para o seu negócio.',
      'Para começar, crie sua conta neste link (válido por 14 dias):',
      opts.registerUrl,
      '',
      'Depois do cadastro, você poderá autorizar o Instagram para avaliarmos o perfil e melhorar o material.',
    ].join('\n');
  }

  async create(dto: CreateInviteDto) {
    const lead = await this.requireOwner(dto.leadId, {
      id: true,
      name: true,
      phone: true,
      whatsapp: true,
    });
    const kind = await this.owners.requireKind(lead.id);

    const phone = dto.phone?.trim() || lead.whatsapp || lead.phone || null;
    const token = randomBytes(24).toString('hex');
    const invite = await this.prisma.invite.create({
      data: {
        token,
        ...ownerCreateData(kind, lead.id),
        phone,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    const registerUrl = this.registerUrl(invite.token);
    const text = this.buildWhatsAppMessage({
      leadName: lead.name,
      registerUrl,
    });

    return {
      id: invite.id,
      token: invite.token,
      leadId: invite.leadId,
      phone: invite.phone,
      status: invite.status,
      expiresAt: invite.expiresAt,
      registerUrl,
      whatsappPayload: {
        phone: invite.phone,
        text,
      },
      evolution: {
        configured: this.evolution.configured(),
        note: 'Envio real ainda não operacional até EVOLUTION_* estar configurado',
      },
    };
  }

  async getPublic(token: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: {
        lead: { select: { id: true, name: true, city: true, state: true } },
        customer: { select: { id: true, name: true, city: true, state: true } },
      },
    });
    if (!invite) throw new NotFoundException('Convite não encontrado');

    const expired = invite.expiresAt.getTime() < Date.now();
    const status = expired && invite.status === 'PENDING' ? 'EXPIRED' : invite.status;
    const owner = invite.lead || invite.customer;
    if (!owner) throw new NotFoundException('Convite sem perfil');

    return {
      token: invite.token,
      status,
      expiresAt: invite.expiresAt,
      lead: {
        name: owner.name,
        city: owner.city,
        state: owner.state,
      },
    };
  }

  async getStudioInvite(id: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { id },
      select: { id: true, leadId: true, customerId: true },
    });
    if (!invite) throw new NotFoundException('Convite não encontrado');
    return invite;
  }

  async sendWhatsApp(id: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { id },
      include: {
        lead: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
    if (!invite) throw new NotFoundException('Convite não encontrado');
    if (!invite.phone) {
      throw new BadRequestException('Convite sem telefone para WhatsApp');
    }
    const registerUrl = this.registerUrl(invite.token);
    const owner = invite.lead || invite.customer;
    const text = this.buildWhatsAppMessage({
      leadName: owner?.name || 'cliente',
      registerUrl,
    });
    const result = await this.evolution.sendText({
      phone: invite.phone,
      text,
    });
    return {
      inviteId: invite.id,
      registerUrl,
      result,
    };
  }

  async sendInstagramPermission(leadId: string) {
    const lead = await this.requireOwner(leadId, {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsapp: true,
      clientAccounts: {
        select: { email: true },
        take: 1,
      },
      instagramConnections: { select: { id: true, username: true }, take: 1 },
    });

    if (lead.instagramConnections.length) {
      return {
        sent: false as const,
        alreadyConnected: true as const,
        username: lead.instagramConnections[0]?.username || null,
      };
    }

    const to =
      normalizeEmail(lead.email) ||
      normalizeEmail(lead.clientAccounts[0]?.email) ||
      null;
    if (!to || !isSendableEmail(to)) {
      throw new BadRequestException(
        'Lead sem e-mail válido para envio. Atualize o e-mail do lead.',
      );
    }

    const hasAccount = lead.clientAccounts.length > 0;
    let inviteId: string | null = null;
    let actionUrl: string;

    if (hasAccount) {
      actionUrl = `${this.publicBaseUrl()}/conectar.html`;
    } else {
      const phone = lead.whatsapp || lead.phone || null;
      const token = randomBytes(24).toString('hex');
      const invite = await this.prisma.invite.create({
        data: {
          token,
          ...ownerCreateData(await this.owners.requireKind(lead.id), lead.id),
          phone,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
      inviteId = invite.id;
      actionUrl = this.registerUrl(invite.token);
    }

    await this.mail.sendInstagramPermission({
      to,
      name: lead.name,
      actionUrl,
      hasAccount,
    });

    return {
      sent: true as const,
      alreadyConnected: false as const,
      to,
      actionUrl,
      hasAccount,
      inviteId,
    };
  }

  async sendSiteIntroduction(leadId: string) {
    const lead = await this.requireOwner(leadId, {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsapp: true,
      publishedOrigin: true,
      clientAccounts: {
        select: { email: true },
        take: 1,
      },
    });

    const to =
      normalizeEmail(lead.email) ||
      normalizeEmail(lead.clientAccounts[0]?.email) ||
      null;
    if (!to || !isSendableEmail(to)) {
      throw new BadRequestException(
        'Lead sem e-mail válido para envio. Atualize o e-mail do lead.',
      );
    }

    const siteUrl = lead.publishedOrigin?.trim() || null;
    if (!siteUrl) {
      throw new BadRequestException(
        'Site ainda não publicado na Vercel. Publique o site para enviar este e-mail.',
      );
    }

    const hasAccount = lead.clientAccounts.some((user) =>
      isSendableEmail(user.email),
    );
    let inviteId: string | null = null;
    let registerUrl: string;

    if (hasAccount) {
      registerUrl = publicLoginUrl(this.config.get('NAMAO_PUBLIC_URL'));
    } else {
      const phone = lead.whatsapp || lead.phone || null;
      const token = randomBytes(24).toString('hex');
      const invite = await this.prisma.invite.create({
        data: {
          token,
          ...ownerCreateData(await this.owners.requireKind(lead.id), lead.id),
          phone,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
      inviteId = invite.id;
      registerUrl = this.registerUrl(invite.token);
    }

    const whatsappUrl = namaoWhatsAppUrl(this.namaoWhatsApp(), lead.name);

    await this.mail.sendSiteIntroduction({
      to,
      name: lead.name,
      siteUrl,
      registerUrl,
      whatsappUrl,
      hasAccount,
    });

    return {
      sent: true as const,
      to,
      siteUrl,
      registerUrl,
      whatsappUrl,
      hasAccount,
      inviteId,
    };
  }

  namaoWhatsApp(): string | null {
    return (
      this.config.get<string>('NAMAO_WHATSAPP')?.trim() ||
      this.config.get<string>('PHONE_NUMBER')?.trim() ||
      null
    );
  }

  private async requireOwner<T extends object>(id: string, select: T) {
    const kind = await this.owners.kindOf(id);
    if (!kind) throw new NotFoundException('Lead não encontrado');
    const row =
      kind === 'lead'
        ? await this.prisma.lead.findUnique({ where: { id }, select })
        : await this.prisma.customer.findUnique({ where: { id }, select });
    if (!row) throw new NotFoundException('Lead não encontrado');
    return row;
  }
}
