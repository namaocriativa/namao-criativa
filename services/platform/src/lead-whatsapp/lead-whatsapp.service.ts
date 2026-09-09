import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvolutionClient } from '../evolution/evolution.client';
import { InvitesService } from '../invites/invites.service';
import { LeadAccountService } from '../lead-account/lead-account.service';
import { publicLoginUrl } from '../lead-account/lead-account.util';
import { LeadActivityService } from '../lead-activity/lead-activity.service';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerWhere } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  PREVIEW_INVITE_TOKEN,
  PREVIEW_PASSWORD,
  applyWhatsAppPlaceholders,
  credentialsWhatsApp,
  instagramPermissionWhatsApp,
  siteIntroductionWhatsApp,
} from '../whatsapp/lead-whatsapp-messages';

export const LEAD_WHATSAPP_KINDS = [
  'site-introduction',
  'instagram-permission',
  'credentials',
] as const;

export type LeadWhatsAppKind = (typeof LEAD_WHATSAPP_KINDS)[number];

const TEMPLATES: Record<
  LeadWhatsAppKind,
  { title: string; description: string }
> = {
  'site-introduction': {
    title: 'Apresentação do site',
    description:
      'Primeiro contato: mostra o site gerado e o posicionamento no Google.',
  },
  'instagram-permission': {
    title: 'Pedido de mídias Instagram',
    description: 'Pede autorização para usar fotos e vídeos do perfil.',
  },
  credentials: {
    title: 'Acesso ao painel',
    description: 'Envia o login e uma nova senha para o lead.',
  },
};

@Injectable()
export class LeadWhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly evolution: EvolutionClient,
    private readonly invites: InvitesService,
    private readonly accounts: LeadAccountService,
    private readonly activity: LeadActivityService,
    private readonly owners: OwnerLookup,
  ) {}

  async list(leadId: string) {
    const lead = await this.requireLead(leadId);
    const to = this.phoneOf(lead);
    const igConnected = lead.instagramConnections.length > 0;
    const siteUrl = lead.publishedOrigin?.trim() || null;
    const evolutionReady = this.evolution.configured();
    const client = await this.prisma.user.findFirst({
      where: { ...ownerWhere(lead.id), role: 'CLIENT' },
      select: { id: true },
    });

    return {
      items: [
        this.listItem('site-introduction', to, {
          available: Boolean(to) && Boolean(siteUrl) && evolutionReady,
          unavailableReason: this.channelReason(to, evolutionReady, {
            extra: siteUrl ? null : 'Site ainda não publicado na Vercel.',
          }),
        }),
        this.listItem('instagram-permission', to, {
          available: Boolean(to) && !igConnected && evolutionReady,
          unavailableReason: this.channelReason(to, evolutionReady, {
            extra: igConnected
              ? lead.instagramConnections[0]?.username
                ? `Instagram já autorizado (@${lead.instagramConnections[0].username}).`
                : 'Instagram já autorizado por este lead.'
              : null,
          }),
        }),
        this.listItem('credentials', to, {
          available: Boolean(to) && Boolean(client) && evolutionReady,
          unavailableReason: this.channelReason(to, evolutionReady, {
            extra: client ? null : 'Lead ainda não tem login no painel.',
          }),
        }),
      ],
    };
  }

  async preview(leadId: string, kind: string) {
    const messageKind = this.parseKind(kind);
    const lead = await this.requireLead(leadId);
    const to = this.phoneOf(lead) || '—';
    const evolutionReady = this.evolution.configured();
    const hasAccount = lead.users.length > 0;

    if (messageKind === 'site-introduction') {
      const siteUrl = lead.publishedOrigin?.trim() || null;
      const registerUrl = hasAccount
        ? publicLoginUrl(this.config.get('NAMAO_PUBLIC_URL'))
        : this.previewRegisterUrl();
      const notices = [
        this.phoneNotice(lead),
        this.evolutionNotice(evolutionReady),
        siteUrl
          ? null
          : 'Site ainda não publicado na Vercel. Publique o site para habilitar o envio.',
        hasAccount ? null : 'O link de cadastro definitivo é gerado no envio.',
      ].filter(Boolean);
      return {
        id: messageKind,
        ...TEMPLATES[messageKind],
        to,
        canSend: Boolean(this.phoneOf(lead)) && Boolean(siteUrl) && evolutionReady,
        text: siteIntroductionWhatsApp({
          name: lead.name,
          siteUrl,
          registerUrl,
          hasAccount,
        }),
        notice: notices.join(' ') || null,
      };
    }

    if (messageKind === 'instagram-permission') {
      const igConnected = lead.instagramConnections.length > 0;
      const actionUrl = hasAccount
        ? `${this.publicBaseUrl()}/conectar.html`
        : this.previewRegisterUrl();
      const notices = [
        this.phoneNotice(lead),
        this.evolutionNotice(evolutionReady),
        igConnected
          ? lead.instagramConnections[0]?.username
            ? `Instagram já autorizado (@${lead.instagramConnections[0].username}).`
            : 'Instagram já autorizado por este lead.'
          : null,
        hasAccount ? null : 'O link de convite definitivo é gerado no envio.',
      ].filter(Boolean);
      return {
        id: messageKind,
        ...TEMPLATES[messageKind],
        to,
        canSend: Boolean(this.phoneOf(lead)) && !igConnected && evolutionReady,
        text: instagramPermissionWhatsApp({
          name: lead.name,
          actionUrl,
          hasAccount,
        }),
        notice: notices.join(' ') || null,
      };
    }

    const loginEmail = lead.users[0]?.email || '—';
    const notices = [
      this.phoneNotice(lead),
      this.evolutionNotice(evolutionReady),
      hasAccount ? null : 'Lead ainda não tem login no painel.',
      'A senha real é gerada só no envio. Se você editar, mantenha o marcador •••••••• para inserirmos a senha.',
    ].filter(Boolean);
    return {
      id: messageKind,
      ...TEMPLATES[messageKind],
      to,
      canSend: Boolean(this.phoneOf(lead)) && hasAccount && evolutionReady,
      text: credentialsWhatsApp({
        name: lead.name,
        email: loginEmail,
        password: PREVIEW_PASSWORD,
        loginUrl: publicLoginUrl(this.config.get('NAMAO_PUBLIC_URL')),
      }),
      notice: notices.join(' ') || null,
    };
  }

  async send(leadId: string, kind: string, editedText?: string) {
    const messageKind = this.parseKind(kind);
    const lead = await this.requireLead(leadId);
    const phone = this.phoneOf(lead);
    if (!phone) {
      throw new BadRequestException(
        'Lead sem WhatsApp ou telefone para envio. Atualize o contato do lead.',
      );
    }
    if (!this.evolution.configured()) {
      throw new BadRequestException('WhatsApp (Evolution) não configurado.');
    }

    if (messageKind === 'instagram-permission' && lead.instagramConnections.length) {
      return {
        sent: false as const,
        alreadyConnected: true as const,
        username: lead.instagramConnections[0]?.username || null,
        to: phone,
      };
    }

    const prepared = await this.prepareMessage(lead, messageKind, phone);
    const text = applyWhatsAppPlaceholders(
      editedText?.trim() || prepared.canonical,
      prepared.replacements,
    );

    const result = await this.evolution.sendText({ phone, text });
    if (result.skipped) {
      throw new BadGatewayException('WhatsApp (Evolution) não configurado.');
    }
    if (!result.ok) {
      throw new BadGatewayException(
        `Falha ao enviar WhatsApp: ${result.error}`,
      );
    }

    await this.activity.record({
      leadId,
      channel: 'whatsapp',
      kind: messageKind,
      title: `WhatsApp enviado: ${TEMPLATES[messageKind].title}`,
      summary: `Enviado para ${phone}`,
      payload: { to: phone, kind: messageKind },
    });

    return {
      sent: true as const,
      to: phone,
      inviteId: prepared.inviteId,
      text,
    };
  }

  private async prepareMessage(
    lead: Awaited<ReturnType<LeadWhatsAppService['requireLead']>>,
    kind: LeadWhatsAppKind,
    phone: string,
  ) {
    const hasAccount = lead.users.length > 0;
    const previewRegisterUrl = this.previewRegisterUrl();

    if (kind === 'site-introduction') {
      const siteUrl = lead.publishedOrigin?.trim() || null;
      if (!siteUrl) {
        throw new BadRequestException(
          'Site ainda não publicado na Vercel. Publique o site para enviar esta mensagem.',
        );
      }
      const action = await this.resolveRegisterAction(lead, phone, hasAccount);
      return {
        canonical: siteIntroductionWhatsApp({
          name: lead.name,
          siteUrl,
          registerUrl: action.url,
          hasAccount,
        }),
        replacements: [[previewRegisterUrl, action.url]] as Array<[string, string]>,
        inviteId: action.inviteId,
      };
    }

    if (kind === 'instagram-permission') {
      const action = hasAccount
        ? {
            url: `${this.publicBaseUrl()}/conectar.html`,
            inviteId: null as string | null,
          }
        : await this.resolveRegisterAction(lead, phone, false);
      return {
        canonical: instagramPermissionWhatsApp({
          name: lead.name,
          actionUrl: action.url,
          hasAccount,
        }),
        replacements: [[previewRegisterUrl, action.url]] as Array<[string, string]>,
        inviteId: action.inviteId,
      };
    }

    const client = await this.prisma.user.findFirst({
      where: { ...ownerWhere(lead.id), role: 'CLIENT' },
      select: { id: true },
    });
    if (!client) {
      throw new BadRequestException('Lead ainda não tem login no painel.');
    }
    const reset = await this.accounts.resetPassword(lead.id);
    const loginUrl = publicLoginUrl(this.config.get('NAMAO_PUBLIC_URL'));
    return {
      canonical: credentialsWhatsApp({
        name: lead.name,
        email: reset.email,
        password: reset.password,
        loginUrl,
      }),
      replacements: [[PREVIEW_PASSWORD, reset.password]] as Array<[string, string]>,
      inviteId: null as string | null,
    };
  }

  private async resolveRegisterAction(
    lead: { id: string },
    phone: string,
    hasAccount: boolean,
  ) {
    if (hasAccount) {
      return {
        url: publicLoginUrl(this.config.get('NAMAO_PUBLIC_URL')),
        inviteId: null as string | null,
      };
    }
    const invite = await this.invites.create({ leadId: lead.id, phone });
    return { url: invite.registerUrl, inviteId: invite.id };
  }

  private listItem(
    id: LeadWhatsAppKind,
    to: string | null,
    state: { available: boolean; unavailableReason: string | null },
  ) {
    return {
      id,
      ...TEMPLATES[id],
      to,
      available: state.available,
      unavailableReason: state.available ? null : state.unavailableReason,
    };
  }

  private channelReason(
    phone: string | null,
    evolutionReady: boolean,
    opts: { extra: string | null },
  ) {
    if (!evolutionReady) return 'WhatsApp (Evolution) não configurado.';
    if (!phone) return 'Lead sem WhatsApp ou telefone para envio.';
    return opts.extra;
  }

  private phoneNotice(lead: { whatsapp: string | null; phone: string | null }) {
    return this.phoneOf(lead)
      ? null
      : 'Lead sem WhatsApp ou telefone para envio. Atualize o contato do lead.';
  }

  private evolutionNotice(ready: boolean) {
    return ready ? null : 'WhatsApp (Evolution) não configurado.';
  }

  private phoneOf(lead: { whatsapp: string | null; phone: string | null }) {
    const value = lead.whatsapp?.trim() || lead.phone?.trim() || '';
    return value || null;
  }

  private previewRegisterUrl() {
    return `${this.publicBaseUrl()}/register.html?invite=${PREVIEW_INVITE_TOKEN}`;
  }

  private publicBaseUrl(): string {
    return (
      this.config.get<string>('NAMAO_PUBLIC_URL')?.replace(/\/$/, '') ||
      'http://localhost:5174'
    );
  }

  private parseKind(kind: string): LeadWhatsAppKind {
    if ((LEAD_WHATSAPP_KINDS as readonly string[]).includes(kind)) {
      return kind as LeadWhatsAppKind;
    }
    throw new BadRequestException('Modelo de WhatsApp desconhecido');
  }

  private async requireLead(leadId: string) {
    const kind = await this.owners.kindOf(leadId);
    if (!kind) throw new NotFoundException(`Lead ${leadId} not found`);
    const select = {
      id: true,
      name: true,
      phone: true,
      whatsapp: true,
      publishedOrigin: true,
      users: {
        where: { role: 'CLIENT' },
        select: { email: true },
        take: 1,
      },
      instagramConnections: {
        select: { username: true },
        take: 1,
      },
    };
    const lead =
      kind === 'lead'
        ? await this.prisma.lead.findUnique({ where: { id: leadId }, select })
        : await this.prisma.customer.findUnique({
            where: { id: leadId },
            select,
          });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);
    return lead;
  }
}
