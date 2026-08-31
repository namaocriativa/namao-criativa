import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  fallbackEmail,
  generatePassword,
  isSendableEmail,
  normalizeEmail,
  publicLoginUrl,
} from './lead-account.util';

export type LeadAccountSeed = {
  id: string;
  name: string;
  email: string | null;
};

export type LeadAccountUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  leadId: string | null;
};

@Injectable()
export class LeadAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async ensureForLead(lead: LeadAccountSeed): Promise<LeadAccountUser> {
    const existing = await this.prisma.user.findFirst({
      where: { leadId: lead.id, role: 'CLIENT' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        leadId: true,
      },
    });
    if (existing) return existing;

    const email = await this.resolveLoginEmail(lead);
    const passwordHash = await bcrypt.hash(generatePassword(), 10);
    return this.prisma.user.create({
      data: {
        email,
        name: lead.name.trim() || 'Cliente',
        passwordHash,
        role: 'CLIENT',
        leadId: lead.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        leadId: true,
      },
    });
  }

  async getAccount(leadId: string) {
    const lead = await this.requireLead(leadId);
    const user = await this.ensureForLead(lead);
    return {
      email: user.email,
      hasPassword: true,
      canEmail: isSendableEmail(user.email),
      loginUrl: this.loginUrl(),
    };
  }

  async resetPassword(leadId: string) {
    const lead = await this.requireLead(leadId);
    const user = await this.ensureForLead(lead);
    const password = generatePassword();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    return { email: user.email, password };
  }

  async sendPassword(leadId: string) {
    const lead = await this.requireLead(leadId);
    const user = await this.ensureForLead(lead);
    if (!isSendableEmail(user.email)) {
      throw new BadRequestException(
        'Este login não tem e-mail válido para envio',
      );
    }
    const password = generatePassword();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    await this.mail.sendCredentials({
      to: user.email,
      name: user.name,
      email: user.email,
      password,
      loginUrl: this.loginUrl(),
    });
    return { email: user.email, password, sent: true };
  }

  private loginUrl(): string {
    return publicLoginUrl(this.config.get<string>('NAMAO_PUBLIC_URL'));
  }

  private async requireLead(leadId: string): Promise<LeadAccountSeed> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, name: true, email: true },
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }
    return lead;
  }

  private async resolveLoginEmail(lead: LeadAccountSeed): Promise<string> {
    const preferred = normalizeEmail(lead.email);
    if (preferred && (await this.emailAvailable(preferred))) {
      return preferred;
    }
    const generated = fallbackEmail(lead.id);
    if (await this.emailAvailable(generated)) {
      return generated;
    }
    return fallbackEmail(`${lead.id}${Date.now()}`);
  }

  private async emailAvailable(email: string): Promise<boolean> {
    const taken = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return !taken;
  }
}
