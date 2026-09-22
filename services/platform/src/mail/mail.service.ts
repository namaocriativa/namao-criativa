import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  credentialsEmailHtml,
  credentialsEmailText,
} from './credentials-email';
import {
  instagramPermissionEmailHtml,
  instagramPermissionEmailText,
} from './instagram-permission-email';
import {
  siteIntroductionEmailHtml,
  siteIntroductionEmailText,
} from './site-introduction-email';
import {
  studioWelcomeEmailHtml,
  studioWelcomeEmailText,
  type StudioWelcomeKind,
} from './studio-welcome-email';
import { transactionalMailFields } from './mail-outbound';
import { publicLogoUrl } from '../lead-account/lead-account.util';

@Injectable()
export class MailService {
  constructor(private readonly config: ConfigService) {}

  async sendCredentials(params: {
    to: string;
    name: string;
    email: string;
    password: string;
    loginUrl: string;
  }) {
    await this.send({
      to: params.to,
      subject: 'Seu acesso à Namão Criativa',
      html: credentialsEmailHtml({
        name: params.name,
        email: params.email,
        password: params.password,
        loginUrl: params.loginUrl,
        logoUrl: this.logoUrl(),
      }),
      text: credentialsEmailText({
        name: params.name,
        email: params.email,
        password: params.password,
        loginUrl: params.loginUrl,
      }),
    });
  }

  async sendStudioWelcome(params: {
    to: string;
    name: string;
    email: string;
    password: string;
    loginUrl: string;
    kind?: StudioWelcomeKind;
  }) {
    const kind = params.kind || 'welcome';
    await this.send({
      to: params.to,
      subject:
        kind === 'reset'
          ? 'Nova senha do studio — Namão Criativa'
          : 'Seu acesso ao studio — Namão Criativa',
      html: studioWelcomeEmailHtml({
        name: params.name,
        email: params.email,
        password: params.password,
        loginUrl: params.loginUrl,
        logoUrl: this.logoUrl(),
        kind,
      }),
      text: studioWelcomeEmailText({
        name: params.name,
        email: params.email,
        password: params.password,
        loginUrl: params.loginUrl,
        kind,
      }),
    });
  }

  async sendInstagramPermission(params: {
    to: string;
    name: string;
    actionUrl: string;
    hasAccount: boolean;
  }) {
    await this.send({
      to: params.to,
      subject: 'Autorização para usar mídias do Instagram — Namão Criativa',
      html: instagramPermissionEmailHtml({
        name: params.name,
        actionUrl: params.actionUrl,
        logoUrl: this.logoUrl(),
        hasAccount: params.hasAccount,
      }),
      text: instagramPermissionEmailText({
        name: params.name,
        actionUrl: params.actionUrl,
        hasAccount: params.hasAccount,
      }),
    });
  }

  async sendSiteIntroduction(params: {
    to: string;
    name: string;
    siteUrl: string | null;
    registerUrl: string;
    whatsappUrl: string | null;
    hasAccount: boolean;
  }) {
    await this.send({
      to: params.to,
      subject: 'Montamos um site profissional para o seu negócio — Namão Criativa',
      html: siteIntroductionEmailHtml({
        name: params.name,
        siteUrl: params.siteUrl,
        registerUrl: params.registerUrl,
        whatsappUrl: params.whatsappUrl,
        logoUrl: this.logoUrl(),
        hasAccount: params.hasAccount,
      }),
      text: siteIntroductionEmailText({
        name: params.name,
        siteUrl: params.siteUrl,
        registerUrl: params.registerUrl,
        whatsappUrl: params.whatsappUrl,
        hasAccount: params.hasAccount,
      }),
    });
  }

  async sendPackageOffer(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) {
    await this.send(params);
  }

  private logoUrl(): string {
    return publicLogoUrl(this.config.get<string>('NAMAO_PUBLIC_URL'));
  }

  private async send(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) {
    const apiKey = this.config.get<string>('RESEND_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'RESEND_API_KEY não configurada',
      );
    }

    const from =
      this.config.get<string>('RESEND_FROM')?.trim() ||
      'Namão Criativa <contato@namaocriativa.com.br>';
    const outbound = transactionalMailFields(from);
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      replyTo: outbound.replyTo,
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: outbound.headers,
      tags: outbound.tags,
    });

    if (error) {
      throw new ServiceUnavailableException(
        error.message || 'Falha ao enviar e-mail',
      );
    }
  }
}
