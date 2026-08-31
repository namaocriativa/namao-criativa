import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtUser } from './jwt.strategy';

const LEAD_SELECT = {
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
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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

  async me(user: JwtUser) {
    if (!user.leadId) {
      return { user, lead: null };
    }
    const lead = await this.prisma.lead.findUnique({
      where: { id: user.leadId },
      select: LEAD_SELECT,
    });
    return { user, lead };
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
