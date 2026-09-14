import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isSendableEmail,
  normalizeEmail,
  publicLoginUrl,
  publicLogoUrl,
} from '../lead-account/lead-account.util';
import { LeadAccountService } from '../lead-account/lead-account.service';
import { InvitesService } from '../invites/invites.service';
import {
  credentialsEmailHtml,
  credentialsEmailText,
} from '../mail/credentials-email';
import {
  instagramPermissionEmailHtml,
  instagramPermissionEmailText,
} from '../mail/instagram-permission-email';
import {
  namaoWhatsAppUrl,
  siteIntroductionEmailHtml,
  siteIntroductionEmailText,
} from '../mail/site-introduction-email';
import { LeadActivityService } from '../lead-activity/lead-activity.service';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerWhere } from '../owner/owner.util';
import { PrismaService } from '../prisma/prisma.service';

export const LEAD_EMAIL_KINDS = [
  'site-introduction',
  'instagram-permission',
  'credentials',
] as const;

export type LeadEmailKind = (typeof LEAD_EMAIL_KINDS)[number];

const TEMPLATES: Record<
  LeadEmailKind,
  { title: string; description: string; subject: string }
> = {
  'site-introduction': {
    title: 'Apresentação do site',
    description:
      'Primeiro contato: mostra o site gerado e o posicionamento no Google.',
    subject: 'Montamos um site profissional para o seu negócio — Namão Criativa',
  },
  'instagram-permission': {
    title: 'Pedido de mídias Instagram',
    description: 'Pede autorização para usar fotos e vídeos do perfil.',
    subject: 'Autorização para usar mídias do Instagram — Namão Criativa',
  },
  credentials: {
    title: 'Acesso ao painel',
    description: 'Envia o login e uma nova senha para o lead.',
    subject: 'Seu acesso à Namão Criativa',
  },
};

@Injectable()
export class LeadMailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly invites: InvitesService,
    private readonly accounts: LeadAccountService,
    private readonly activity: LeadActivityService,
    private readonly owners: OwnerLookup,
  ) {}

  async list(leadId: string) {
    const lead = await this.requireLead(leadId);
    const to = this.instagramRecipient(lead);
    const igConnected = lead.instagramConnections.length > 0;
    const cred = await this.credentialsRecipient(lead);
    const siteUrl = lead.publishedOrigin?.trim() || null;

    return {
      items: [
        {
          id: 'site-introduction' as const,
          ...TEMPLATES['site-introduction'],
          to,
          available: Boolean(to) && Boolean(siteUrl),
          unavailableReason: to
            ? siteUrl
              ? null
              : 'Site ainda não publicado na Vercel.'
            : 'Lead sem e-mail válido para envio.',
        },
        {
          id: 'instagram-permission' as const,
          ...TEMPLATES['instagram-permission'],
          to,
          available: Boolean(to) && !igConnected,
          unavailableReason: igConnected
            ? lead.instagramConnections[0]?.username
              ? `Instagram já autorizado (@${lead.instagramConnections[0].username}).`
              : 'Instagram já autorizado por este lead.'
            : to
              ? null
              : 'Lead sem e-mail válido para envio.',
        },
        {
          id: 'credentials' as const,
          ...TEMPLATES.credentials,
          to: cred.to,
          available: cred.available,
          unavailableReason: cred.available
            ? null
            : 'Este login não tem e-mail válido para envio.',
        },
      ],
    };
  }

  async preview(leadId: string, kind: string) {
    const emailKind = this.parseKind(kind);
    const lead = await this.requireLead(leadId);
    const logoUrl = publicLogoUrl(this.config.get<string>('NAMAO_PUBLIC_URL'));

    if (emailKind === 'site-introduction') {
      return this.previewSiteIntroduction(lead, logoUrl);
    }

    if (emailKind === 'instagram-permission') {
      const to = this.instagramRecipient(lead);
      const igConnected = lead.instagramConnections.length > 0;
      const hasAccount = lead.clientAccounts.length > 0;
      const actionUrl = hasAccount
        ? `${this.publicBaseUrl()}/conectar.html`
        : `${this.publicBaseUrl()}/register.html?invite=preview`;
      const notices = [
        !to
          ? 'Lead sem e-mail válido para envio. Atualize o e-mail do lead.'
          : null,
        igConnected
          ? lead.instagramConnections[0]?.username
            ? `Instagram já autorizado (@${lead.instagramConnections[0].username}).`
            : 'Instagram já autorizado por este lead.'
          : null,
        hasAccount ? null : 'O link de convite definitivo é gerado no envio.',
      ].filter(Boolean);
      return {
        id: emailKind,
        ...TEMPLATES[emailKind],
        to: to || '—',
        canSend: Boolean(to) && !igConnected,
        html: instagramPermissionEmailHtml({
          name: lead.name,
          actionUrl,
          logoUrl,
          hasAccount,
        }),
        text: instagramPermissionEmailText({
          name: lead.name,
          actionUrl,
          hasAccount,
        }),
        notice: notices.join(' ') || null,
      };
    }

    const account = await this.accounts.getAccount(leadId);
    const previewPassword = '••••••••';
    const notices = [
      account.canEmail
        ? null
        : 'Este login não tem e-mail válido para envio. Atualize o e-mail do lead.',
      'A senha real é gerada só no envio.',
    ].filter(Boolean);
    return {
      id: emailKind,
      ...TEMPLATES[emailKind],
      to: account.canEmail ? account.email : '—',
      canSend: account.canEmail,
      html: credentialsEmailHtml({
        name: lead.name,
        email: account.email,
        password: previewPassword,
        loginUrl: account.loginUrl || publicLoginUrl(this.config.get('NAMAO_PUBLIC_URL')),
        logoUrl,
      }),
      text: credentialsEmailText({
        name: lead.name,
        email: account.email,
        password: previewPassword,
        loginUrl: account.loginUrl || publicLoginUrl(this.config.get('NAMAO_PUBLIC_URL')),
      }),
      notice: notices.join(' '),
    };
  }

  async send(leadId: string, kind: string) {
    const emailKind = this.parseKind(kind);
    const result =
      emailKind === 'site-introduction'
        ? await this.invites.sendSiteIntroduction(leadId)
        : emailKind === 'instagram-permission'
          ? await this.invites.sendInstagramPermission(leadId)
          : await this.accounts.sendPassword(leadId);

    if ('alreadyConnected' in result && result.alreadyConnected) {
      return result;
    }
    if (result.sent === false) {
      return result;
    }

    const to =
      'to' in result && typeof result.to === 'string' && result.to
        ? result.to
        : 'email' in result && typeof result.email === 'string'
          ? result.email
          : null;

    await this.activity.record({
      leadId,
      channel: 'email',
      kind: emailKind,
      title: `E-mail enviado: ${TEMPLATES[emailKind].title}`,
      summary: to ? `Enviado para ${to}` : 'E-mail enviado',
      payload: { to, kind: emailKind },
    });

    return result;
  }

  private previewSiteIntroduction(
    lead: {
      name: string;
      email: string | null;
      publishedOrigin: string | null;
      clientAccounts: Array<{ email: string }>;
    },
    logoUrl: string,
  ) {
    const to = this.instagramRecipient(lead);
    const siteUrl = lead.publishedOrigin?.trim() || null;
    const hasAccount = lead.clientAccounts.some((user) =>
      isSendableEmail(user.email),
    );
    const registerUrl = hasAccount
      ? publicLoginUrl(this.config.get('NAMAO_PUBLIC_URL'))
      : `${this.publicBaseUrl()}/register.html?invite=preview`;
    const whatsappUrl = namaoWhatsAppUrl(
      this.invites.namaoWhatsApp(),
      lead.name,
    );
    const notices = [
      !to
        ? 'Lead sem e-mail válido para envio. Atualize o e-mail do lead.'
        : null,
      siteUrl
        ? null
        : 'Site ainda não publicado na Vercel. Publique o site para habilitar o envio.',
      hasAccount ? null : 'O link de cadastro definitivo é gerado no envio.',
      whatsappUrl
        ? null
        : 'WhatsApp da Namão não configurado (NAMAO_WHATSAPP).',
    ].filter(Boolean);
    return {
      id: 'site-introduction' as const,
      ...TEMPLATES['site-introduction'],
      to: to || '—',
      canSend: Boolean(to) && Boolean(siteUrl),
      html: siteIntroductionEmailHtml({
        name: lead.name,
        siteUrl,
        registerUrl,
        whatsappUrl,
        logoUrl,
        hasAccount,
      }),
      text: siteIntroductionEmailText({
        name: lead.name,
        siteUrl,
        registerUrl,
        whatsappUrl,
        hasAccount,
      }),
      notice: notices.join(' ') || null,
    };
  }

  private parseKind(kind: string): LeadEmailKind {
    if ((LEAD_EMAIL_KINDS as readonly string[]).includes(kind)) {
      return kind as LeadEmailKind;
    }
    throw new BadRequestException('Modelo de e-mail desconhecido');
  }

  private publicBaseUrl(): string {
    return (
      this.config.get<string>('NAMAO_PUBLIC_URL')?.replace(/\/$/, '') ||
      'http://localhost:5174'
    );
  }

  private instagramRecipient(lead: {
    email: string | null;
    clientAccounts: Array<{ email: string }>;
  }): string | null {
    const to =
      normalizeEmail(lead.email) ||
      normalizeEmail(lead.clientAccounts[0]?.email);
    return to && isSendableEmail(to) ? to : null;
  }

  private async credentialsRecipient(lead: {
    id: string;
    email: string | null;
  }) {
    const user = await this.prisma.clientAccount.findFirst({
      where: ownerWhere(lead.id),
      select: { email: true },
    });
    const email = normalizeEmail(user?.email) || normalizeEmail(lead.email);
    const available = Boolean(email && isSendableEmail(email));
    return { to: available ? email : null, available };
  }

  private async requireLead(leadId: string) {
    const kind = await this.owners.kindOf(leadId);
    if (!kind) throw new NotFoundException(`Lead ${leadId} not found`);
    const select = {
      id: true,
      name: true,
      email: true,
      publishedOrigin: true,
      clientAccounts: {
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
