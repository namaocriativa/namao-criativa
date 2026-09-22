import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth/auth.service';
import { primaryOrigin } from '../auth/cookie-origin';
import type { JwtUser } from '../auth/jwt.strategy';
import { isStudioRoot, USER_ROLE } from '../auth/roles';
import { generatePassword } from '../lead-account/lead-account.util';
import { MailService } from '../mail/mail.service';
import { DEFAULT_OFFER_TEMPLATE } from '../packages/offer-template';
import { PrismaService } from '../prisma/prisma.service';
import { nameFromEmail } from '../studio-users/studio-users.util';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TENANT_STATUS } from './tenant.constants';
import { slugifyTenantName } from './tenant.util';

const TENANT_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      users: true,
      leads: true,
      customers: true,
    },
  },
} as const;

const TENANT_STAFF_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} as const;

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  list() {
    return this.prisma.tenant.findMany({
      select: TENANT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: TENANT_SELECT,
    });
    if (!tenant) {
      throw new NotFoundException('Conta não encontrada');
    }
    return tenant;
  }

  async activity(id: string) {
    const tenant = await this.get(id);
    const staff = await this.prisma.user.findMany({
      where: {
        tenantId: id,
        role: { in: [USER_ROLE.ADMIN, USER_ROLE.OPERATOR] },
      },
      select: TENANT_STAFF_SELECT,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    const rows = await this.prisma.studioUserActivity.findMany({
      where: { user: { tenantId: id } },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      ...tenant,
      staff,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        summary: row.summary || null,
        kind: row.kind,
        at: row.createdAt.toISOString(),
        user: row.user,
      })),
    };
  }

  async create(dto: CreateTenantDto) {
    const name = dto.name.trim();
    const adminEmail = dto.adminEmail.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw new BadRequestException('Este e-mail já tem acesso ao studio');
    }

    const slug = await this.uniqueSlug(name);
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const adminName = nameFromEmail(adminEmail);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name,
          slug,
          status: TENANT_STATUS.ACTIVE,
        },
        select: TENANT_SELECT,
      });
      await tx.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          passwordHash,
          role: USER_ROLE.ADMIN,
          tenantId: created.id,
        },
      });
      await tx.offerTemplate.create({
        data: {
          tenantId: created.id,
          ...DEFAULT_OFFER_TEMPLATE,
        },
      });
      return created;
    });

    try {
      await this.mail.sendStudioWelcome({
        to: adminEmail,
        name: adminName,
        email: adminEmail,
        password,
        loginUrl: this.studioLoginUrl(),
        kind: 'welcome',
      });
    } catch (error) {
      await this.prisma.user
        .deleteMany({ where: { email: adminEmail, tenantId: tenant.id } })
        .catch(() => {});
      await this.prisma.offerTemplate
        .deleteMany({ where: { tenantId: tenant.id } })
        .catch(() => {});
      await this.prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
      throw error;
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.get(id);
    const name = dto.name?.trim();
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      select: TENANT_SELECT,
    });
  }

  async impersonate(actor: JwtUser, tenantId: string) {
    if (!isStudioRoot(actor.role)) {
      throw new ForbiddenException('Apenas o root pode entrar em uma conta');
    }
    return this.prisma.tenant
      .findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, status: true },
      })
      .then((tenant) => {
        if (!tenant) throw new NotFoundException('Conta não encontrada');
        return this.auth.impersonateTenant(actor, tenant);
      });
  }

  stopImpersonation(actor: JwtUser) {
    return this.auth.stopImpersonation(actor);
  }

  private studioLoginUrl() {
    const origin = primaryOrigin(
      this.config.get<string>('NAMAO_STUDIO_URL'),
      'http://localhost:5173',
    );
    return `${origin}/login`;
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugifyTenantName(name);
    let slug = base;
    let n = 2;
    while (await this.prisma.tenant.findUnique({ where: { slug } })) {
      slug = `${base}-${n}`;
      n += 1;
    }
    return slug;
  }
}
