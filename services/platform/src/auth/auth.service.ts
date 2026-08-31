import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtUser } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const invite = await this.prisma.invite.findUnique({
      where: { token: dto.inviteToken },
      include: { lead: { select: { id: true, name: true } } },
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

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash,
          role: 'CLIENT',
          leadId: invite.leadId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          leadId: true,
        },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });
      return created;
    });

    return this.issue(user);
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
    });
  }

  me(user: JwtUser) {
    return { user };
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
