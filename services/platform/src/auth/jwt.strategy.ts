import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { TENANT_STATUS } from '../tenant/tenant.constants';
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
import { isStudioRole, isStudioRoot, isTenantStaffRole } from './roles';

export type { JwtUser } from './identity';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  typ?: JwtTyp;
  tenantId?: string | null;
  impersonatingTenantId?: string | null;
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
      (source === 'studio-cookie' || source === 'admin-cookie'
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

      if (isStudioRoot(user.role)) {
        const impersonatingId =
          payload.impersonatingTenantId || payload.tenantId || null;
        if (!impersonatingId) {
          return staffToJwt({
            ...user,
            tenantId: null,
            impersonatingTenantId: null,
            tenantName: null,
          });
        }
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: impersonatingId },
          select: { id: true, name: true, status: true },
        });
        if (!tenant || tenant.status !== TENANT_STATUS.ACTIVE) {
          return staffToJwt({
            ...user,
            tenantId: null,
            impersonatingTenantId: null,
            tenantName: null,
          });
        }
        return staffToJwt({
          ...user,
          tenantId: tenant.id,
          impersonatingTenantId: tenant.id,
          tenantName: tenant.name,
          canAccessImages: true,
          canAccessVideos: true,
        });
      }

      if (!isTenantStaffRole(user.role) || !user.tenantId) return null;
      if (user.tenant?.status !== TENANT_STATUS.ACTIVE) return null;
      return staffToJwt(user);
    }

    if (source === 'studio-cookie' || source === 'admin-cookie') return null;
    const account = await this.prisma.clientAccount.findUnique({
      where: { id: payload.sub },
      select: CLIENT_ACCOUNT_SELECT,
    });
    return account ? clientAccountToJwt(account) : null;
  }
}
