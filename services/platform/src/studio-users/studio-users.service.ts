import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { generatePassword } from '../lead-account/lead-account.util';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtUser } from '../auth/jwt.strategy';
import { isStudioRole, USER_ROLE } from '../auth/roles';
import { MailService } from '../mail/mail.service';
import { CreateStudioUserDto } from './dto/create-studio-user.dto';
import { UpdateStudioUserDto } from './dto/update-studio-user.dto';

const STUDIO_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class StudioUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      where: { role: { in: [USER_ROLE.ADMIN, USER_ROLE.OPERATOR] } },
      select: STUDIO_USER_SELECT,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateStudioUserDto) {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Nome é obrigatório');
    }
    if (!isStudioRole(dto.role)) {
      throw new BadRequestException('Papel inválido');
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Este e-mail já tem conta');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: dto.role,
      },
      select: STUDIO_USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateStudioUserDto, actor: JwtUser) {
    const user = await this.requireStudioUser(id);
    if (dto.role && dto.role !== user.role) {
      await this.assertCanChangeRole(user, dto.role, actor);
    }
    const name = dto.name?.trim();
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(dto.role ? { role: dto.role } : {}),
      },
      select: STUDIO_USER_SELECT,
    });
  }

  async resetPassword(id: string) {
    const user = await this.requireStudioUser(id);
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
    const origin = (
      this.config.get<string>('NAMAO_STUDIO_URL') || 'http://localhost:5173'
    ).replace(/\/$/, '');
    await this.mail.sendCredentials({
      to: user.email,
      name: user.name,
      email: user.email,
      password,
      loginUrl: `${origin}/login`,
    });
    return { ok: true as const };
  }

  async remove(id: string, actor: JwtUser) {
    const user = await this.requireStudioUser(id);
    if (user.id === actor.id) {
      throw new ForbiddenException('Não é possível remover a própria conta');
    }
    if (user.role === USER_ROLE.ADMIN) {
      await this.assertAnotherAdmin(user.id);
    }
    await this.prisma.user.delete({ where: { id } });
    return { ok: true as const };
  }

  private async requireStudioUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: STUDIO_USER_SELECT,
    });
    if (!user || !isStudioRole(user.role)) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }

  private async assertCanChangeRole(
    user: { id: string; role: string },
    nextRole: string,
    actor: JwtUser,
  ) {
    if (!isStudioRole(nextRole)) {
      throw new BadRequestException('Papel inválido');
    }
    if (user.role === USER_ROLE.ADMIN && nextRole !== USER_ROLE.ADMIN) {
      await this.assertAnotherAdmin(user.id);
    }
    if (user.id === actor.id && nextRole !== USER_ROLE.ADMIN) {
      throw new ForbiddenException('Não é possível rebaixar a própria conta');
    }
  }

  private async assertAnotherAdmin(exceptId: string) {
    const remaining = await this.prisma.user.count({
      where: {
        role: USER_ROLE.ADMIN,
        id: { not: exceptId },
      },
    });
    if (remaining < 1) {
      throw new ForbiddenException('Não é possível remover o último admin');
    }
  }
}
