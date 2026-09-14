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
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  INSTAGRAM_HANDLE,
  instagramProfileUrl,
  normalizeInstagram,
} from './instagram';
import { JwtUser } from './jwt.strategy';
import { isStudioRole, USER_ROLE } from './roles';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureStudioAdmin();
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

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException(
        'Este e-mail já tem conta. Use o link enviado por e-mail para entrar.',
      );
    }

    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const owner = invite ? invite.lead || invite.customer : null;
      const ownerId = invite
        ? invite.customerId || invite.leadId
        : (
            await tx.lead.create({
              data: {
                name,
                email,
                instagram: instagramUrl,
                fromPublicSignup: true,
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

      return tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: 'CLIENT',
          leadId: invite?.customerId ? null : ownerId,
          customerId: invite?.customerId || null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          leadId: true,
          customerId: true,
        },
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
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.issue({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      leadId: user.leadId,
      customerId: user.customerId,
    });
  }

  async studioLogin(dto: LoginDto) {
    const issued = await this.login(dto);
    if (!isStudioRole(issued.user.role)) {
      throw new ForbiddenException('Sem permissão para o studio');
    }
    return issued;
  }

  async ensureStudioAdmin() {
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
    if (existing) return;
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.create({
      data: {
        email,
        name: 'Admin',
        passwordHash,
        role: USER_ROLE.ADMIN,
      },
    });
    this.logger.log(`Usuário admin do studio criado: ${email}`);
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
    };
  }

  private namaoWhatsApp(): string | null {
    return (
      this.config.get<string>('NAMAO_WHATSAPP')?.trim() ||
      this.config.get<string>('PHONE_NUMBER')?.trim() ||
      null
    );
  }

  private issue(user: JwtUser) {
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return { accessToken, user };
  }
}
