import type { Request } from 'express';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import {
  generatePassword,
  publicLoginUrl,
} from '../lead-account/lead-account.util';
import { MailService } from '../mail/mail.service';
import { namaoWhatsAppUrl } from '../mail/site-introduction-email';
import { PrismaService } from '../prisma/prisma.service';
import { StudioActivityService } from '../studio-activity/studio-activity.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  INSTAGRAM_HANDLE,
  instagramProfileUrl,
  normalizeInstagram,
} from './instagram';
import {
  extractJwtFromRequest,
  STUDIO_REMEMBER_EXPIRES_IN,
  STUDIO_SESSION_EXPIRES_IN,
  type StudioJwtExpiresIn,
} from './jwt-cookie';
import {
  CLIENT_ACCOUNT_SELECT,
  JWT_TYP,
  clientAccountToJwt,
  staffToJwt,
} from './identity';
import { JwtUser } from './jwt.strategy';
import { isStudioRole, isStudioRoot, isTenantStaffRole, USER_ROLE } from './roles';
import {
  DEFAULT_TENANT_SLUG,
  TENANT_STATUS,
} from '../tenant/tenant.constants';
import { resolveDefaultTenantId } from '../tenant/tenant.util';
import { ownerWhere } from '../owner/owner.util';
import { clientProposalSummary } from '../proposal/proposal.view';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly activity: StudioActivityService,
  ) {}

  async onModuleInit() {
    await this.ensureStudioRoot();
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    const handle = normalizeInstagram(dto.instagram);
    if (!INSTAGRAM_HANDLE.test(handle)) {
      throw new BadRequestException('Instagram inválido');
    }
    const instagramUrl = instagramProfileUrl(handle);
    const inviteToken = dto.inviteToken?.trim() || '';

    const invite = inviteToken
      ? await this.requirePendingInvite(inviteToken)
      : null;

    const existing = await this.prisma.clientAccount.findUnique({
      where: { email },
    });
    if (existing) {
      throw new BadRequestException(
        'Este e-mail já tem conta. Use o link enviado por e-mail para entrar.',
      );
    }

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const owner = invite ? invite.lead || invite.customer : null;
      const tenantId =
        invite?.tenantId || (await resolveDefaultTenantId(tx));
      const ownerId = invite
        ? invite.customerId || invite.leadId
        : (
            await tx.lead.create({
              data: {
                name,
                email,
                instagram: instagramUrl,
                fromPublicSignup: true,
                tenantId,
              },
              select: { id: true },
            })
          ).id;

      if (!ownerId) {
        throw new BadRequestException('Convite sem perfil vinculado');
      }

      if (invite && owner) {
        await tx.invite.update({
          where: { id: invite.id },
          data: { status: 'ACCEPTED' },
        });
        const leadPatch = {
          ...(owner.email ? {} : { email }),
          ...(owner.instagram ? {} : { instagram: instagramUrl }),
        };
        if (Object.keys(leadPatch).length > 0) {
          if (invite.customerId) {
            await tx.customer.update({
              where: { id: invite.customerId },
              data: leadPatch,
            });
          } else if (invite.leadId) {
            await tx.lead.update({
              where: { id: invite.leadId },
              data: leadPatch,
            });
          }
        }
      }

      return tx.clientAccount.create({
        data: {
          email,
          name,
          passwordHash,
          tenantId,
          leadId: invite?.customerId ? null : ownerId,
          customerId: invite?.customerId || null,
        },
        select: CLIENT_ACCOUNT_SELECT,
      });
    });

    let mailed = false;
    try {
      await this.mail.sendCredentials({
        to: email,
        name: user.name,
        email,
        password,
        loginUrl: publicLoginUrl(this.config.get<string>('NAMAO_PUBLIC_URL')),
      });
      mailed = true;
    } catch (error) {
      this.logger.error(
        `Falha ao enviar senha para ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return { ok: true as const, mailed };
  }

  private async requirePendingInvite(token: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: {
        lead: { select: { id: true, email: true, instagram: true } },
        customer: { select: { id: true, email: true, instagram: true } },
      },
    });
    if (!invite) {
      throw new BadRequestException('Convite inválido');
    }
    if (invite.status !== 'PENDING') {
      throw new BadRequestException('Convite já utilizado ou expirado');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      await this.prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Convite expirado');
    }
    return invite;
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const account = await this.prisma.clientAccount.findUnique({
      where: { email },
    });
    if (!account) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await bcrypt.compare(dto.password, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.issue(clientAccountToJwt(account));
  }

  async studioLogin(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: { select: { id: true, name: true, status: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!isStudioRole(user.role)) {
      throw new ForbiddenException('Sem permissão para o studio');
    }
    if (isTenantStaffRole(user.role)) {
      if (!user.tenantId || user.tenant?.status !== TENANT_STATUS.ACTIVE) {
        throw new ForbiddenException('Conta desativada');
      }
    }
    const jwtUser = isStudioRoot(user.role)
      ? staffToJwt({
          ...user,
          ...(await this.defaultTenantSession()),
        })
      : staffToJwt(user);
    const issued = this.issue(jwtUser, {
      expiresIn:
        dto.rememberMe === false
          ? STUDIO_SESSION_EXPIRES_IN
          : STUDIO_REMEMBER_EXPIRES_IN,
    });
    await this.activity.recordLogin(issued.user.id);
    return issued;
  }

  async adminLogin(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: { select: { id: true, name: true, status: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!isStudioRoot(user.role)) {
      throw new ForbiddenException('Sem permissão para o admin');
    }
    return this.issue(
      staffToJwt({
        ...user,
        tenantId: null,
        impersonatingTenantId: null,
        tenantName: null,
      }),
      {
        expiresIn:
          dto.rememberMe === false
            ? STUDIO_SESSION_EXPIRES_IN
            : STUDIO_REMEMBER_EXPIRES_IN,
      },
    );
  }

  async recordStudioLogout(req: Request) {
    try {
      const token = extractJwtFromRequest(req);
      if (!token) return;
      const payload = this.jwt.verify<{ sub?: string }>(token);
      if (payload?.sub) await this.activity.recordLogout(payload.sub);
    } catch {
      // cookie ausente ou JWT inválido: logout ainda limpa o cookie
    }
  }

  async ensureStudioRoot() {
    await resolveDefaultTenantId(this.prisma);
    const email = this.config.get<string>('STUDIO_ADMIN_EMAIL')?.trim().toLowerCase();
    const password = this.config.get<string>('STUDIO_ADMIN_PASSWORD')?.trim();
    if (!email || !password) return;
    if (password.length < 8) {
      this.logger.warn(
        'STUDIO_ADMIN_PASSWORD precisa ter pelo menos 8 caracteres; bootstrap ignorado',
      );
      return;
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (!isStudioRole(existing.role)) {
        this.logger.warn(
          `STUDIO_ADMIN_EMAIL ${email} existe sem papel de studio; bootstrap ignorado`,
        );
        return;
      }
      if (
        existing.role !== USER_ROLE.ROOT ||
        existing.tenantId !== null
      ) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { role: USER_ROLE.ROOT, tenantId: null },
        });
        this.logger.log(`Usuário root do studio promovido: ${email}`);
      }
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.create({
      data: {
        email,
        name: 'Root',
        passwordHash,
        role: USER_ROLE.ROOT,
        tenantId: null,
      },
    });
    this.logger.log(`Usuário root do studio criado: ${email}`);
  }

  issueStudioSession(
    user: JwtUser,
    options?: { expiresIn?: StudioJwtExpiresIn },
  ) {
    return this.issue(user, options);
  }

  private async defaultTenantSession() {
    let tenant = await this.prisma.tenant.findUnique({
      where: { slug: DEFAULT_TENANT_SLUG },
      select: { id: true, name: true, status: true },
    });
    if (!tenant) {
      await resolveDefaultTenantId(this.prisma);
      tenant = await this.prisma.tenant.findUnique({
        where: { slug: DEFAULT_TENANT_SLUG },
        select: { id: true, name: true, status: true },
      });
    }
    if (!tenant || tenant.status !== TENANT_STATUS.ACTIVE) {
      throw new ForbiddenException('Conta desativada');
    }
    return {
      tenantId: tenant.id,
      impersonatingTenantId: tenant.id,
      tenantName: tenant.name,
      canAccessImages: true,
      canAccessVideos: true,
    };
  }

  impersonateTenant(
    root: JwtUser,
    tenant: { id: string; name: string; status: string },
  ) {
    if (!isStudioRoot(root.role)) {
      throw new ForbiddenException('Apenas o root pode entrar em uma conta');
    }
    if (tenant.status !== TENANT_STATUS.ACTIVE) {
      throw new ForbiddenException('Conta desativada');
    }
    return this.issue(
      staffToJwt({
        id: root.id,
        email: root.email,
        name: root.name,
        role: USER_ROLE.ROOT,
        tenantId: tenant.id,
        impersonatingTenantId: tenant.id,
        tenantName: tenant.name,
        canAccessImages: true,
        canAccessVideos: true,
      }),
      { expiresIn: STUDIO_REMEMBER_EXPIRES_IN },
    );
  }

  stopImpersonation(root: JwtUser) {
    if (!isStudioRoot(root.role)) {
      throw new ForbiddenException('Apenas o root pode sair da conta');
    }
    return this.issue(
      staffToJwt({
        id: root.id,
        email: root.email,
        name: root.name,
        role: USER_ROLE.ROOT,
        tenantId: null,
        impersonatingTenantId: null,
        tenantName: null,
      }),
      { expiresIn: STUDIO_REMEMBER_EXPIRES_IN },
    );
  }

  async me(user: JwtUser) {
    const ownerId = user.customerId || user.leadId;
    const profileSelect = {
      id: true,
      name: true,
      email: true,
      phone: true,
      whatsapp: true,
      city: true,
      state: true,
      website: true,
      instagram: true,
      category: true,
      description: true,
      landingStatus: true,
      publishedOrigin: true,
      createdAt: true,
      fromPublicSignup: true,
    };

    const leadRow = ownerId
      ? await this.prisma.lead.findUnique({
          where: { id: ownerId },
          select: profileSelect,
        })
      : null;
    const customerRow =
      ownerId && !leadRow
        ? await this.prisma.customer.findUnique({
            where: { id: ownerId },
            select: profileSelect,
          })
        : null;
    const profile = leadRow || customerRow;
    const accountKind = leadRow
      ? ('lead' as const)
      : customerRow
        ? ('customer' as const)
        : null;

    const connection = ownerId
      ? await this.prisma.instagramConnection.findFirst({
          where: { OR: [{ leadId: ownerId }, { customerId: ownerId }] },
          select: { username: true, igUserId: true },
        })
      : null;

    const who = profile?.name || user.name;
    const contactWhatsAppUrl = namaoWhatsAppUrl(
      this.namaoWhatsApp(),
      who,
      `Olá! Sou ${who}. Criei uma conta na Namão e quero falar sobre o pagamento para o serviço completo.`,
    );

    const proposalRow = ownerId
      ? await this.prisma.proposal.findFirst({
          where: ownerWhere(ownerId),
          orderBy: { createdAt: 'desc' },
        })
      : null;
    const { proposal, payment } = await clientProposalSummary(
      proposalRow,
      this.config,
    );

    return {
      user,
      accountKind,
      lead: profile,
      instagram: connection
        ? {
            connected: true as const,
            username: connection.username,
            igUserId: connection.igUserId,
          }
        : { connected: false as const },
      contactWhatsAppUrl,
      proposal,
      payment,
    };
  }

  private namaoWhatsApp(): string | null {
    return (
      this.config.get<string>('NAMAO_WHATSAPP')?.trim() ||
      this.config.get<string>('PHONE_NUMBER')?.trim() ||
      null
    );
  }

  private issue(user: JwtUser, options?: { expiresIn?: StudioJwtExpiresIn }) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      typ: user.typ || (isStudioRole(user.role) ? JWT_TYP.STAFF : JWT_TYP.CLIENT),
      tenantId: user.tenantId ?? null,
      impersonatingTenantId: user.impersonatingTenantId ?? null,
    };
    const accessToken = options?.expiresIn
      ? this.jwt.sign(payload, { expiresIn: options.expiresIn })
      : this.jwt.sign(payload);
    return { accessToken, user };
  }
}
