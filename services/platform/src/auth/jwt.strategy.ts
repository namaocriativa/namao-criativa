import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  CLIENT_ACCOUNT_SELECT,
  JWT_TYP,
  STAFF_ACCOUNT_SELECT,
  clientAccountToJwt,
  staffToJwt,
  type JwtTyp,
  type JwtUser,
} from './identity';
import { inspectJwtFromRequest } from './jwt-cookie';
import { resolveJwtSecret } from './jwt-secret';
import { isStudioRole } from './roles';

export type { JwtUser } from './identity';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  typ?: JwtTyp;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => inspectJwtFromRequest(req)?.token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config.get<string>('JWT_SECRET')),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<JwtUser | null> {
    const source = inspectJwtFromRequest(req)?.source;
    const typ =
      payload.typ ||
      (source === 'studio-cookie'
        ? JWT_TYP.STAFF
        : source === 'client-cookie'
          ? JWT_TYP.CLIENT
          : isStudioRole(payload.role)
            ? JWT_TYP.STAFF
            : JWT_TYP.CLIENT);

    if (typ === JWT_TYP.STAFF) {
      if (source === 'client-cookie') return null;
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: STAFF_ACCOUNT_SELECT,
      });
      if (!user || !isStudioRole(user.role)) return null;
      return staffToJwt(user);
    }

    if (source === 'studio-cookie') return null;
    const account = await this.prisma.clientAccount.findUnique({
      where: { id: payload.sub },
      select: CLIENT_ACCOUNT_SELECT,
    });
    return account ? clientAccountToJwt(account) : null;
  }
}
