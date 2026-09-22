import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { USER_ROLE } from '../auth/roles';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerLookup } from '../owner/owner-lookup.service';
import { ownerCreateData, ownerWhere } from '../owner/owner.util';
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
  customerId: string | null;
};

const CLIENT_ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  leadId: true,
  customerId: true,
} as const;

@Injectable()
export class LeadAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly owners: OwnerLookup,
  ) {}

  async ensureForLead(lead: LeadAccountSeed): Promise<LeadAccountUser> {
    const existing = await this.prisma.clientAccount.findFirst({
      where: ownerWhere(lead.id),
      select: CLIENT_ACCOUNT_SELECT,
    });
    if (existing) return this.toLeadAccount(existing);

    const kind = await this.owners.requireKind(lead.id);
    const email = await this.resolveLoginEmail(lead);
    const passwordHash = await bcrypt.hash(generatePassword(), 10);
    const created = await this.prisma.clientAccount.create({
      data: {
        email,
        name: lead.name.trim() || 'Cliente',
        passwordHash,
        tenantId: await this.ownerTenantId(lead.id),
        ...ownerCreateData(kind, lead.id),
      },
      select: CLIENT_ACCOUNT_SELECT,
    });
    return this.toLeadAccount(created);
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
    await this.prisma.clientAccount.update({
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
    await this.prisma.clientAccount.update({
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
    const profile = await this.owners.findProfile(leadId);
    if (!profile) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }
    return { id: profile.id, name: profile.name, email: profile.email };
  }

  private async ownerTenantId(id: string): Promise<string> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (lead) return lead.tenantId;
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (customer) return customer.tenantId;
    throw new NotFoundException(`Lead ${id} not found`);
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
    const taken = await this.prisma.clientAccount.findUnique({
      where: { email },
      select: { id: true },
    });
    return !taken;
  }

  private toLeadAccount(account: {
    id: string;
    email: string;
    name: string;
    leadId: string | null;
    customerId: string | null;
  }): LeadAccountUser {
    return { ...account, role: USER_ROLE.CLIENT };
  }
}
