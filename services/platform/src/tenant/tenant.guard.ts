import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import type { JwtUser } from '../auth/jwt.strategy';
import { JWT_TYP } from '../auth/identity';
import { isStudioRoot, USER_ROLE } from '../auth/roles';

function requestPath(request: { originalUrl?: string; url?: string }): string {
  const raw = String(request.originalUrl || request.url || '');
  return raw.split('?')[0] || '/';
}

function isRootConsolePath(path: string): boolean {
  return path === '/studio/tenants' || path.startsWith('/studio/tenants/');
}

function isAuthPath(path: string): boolean {
  return path === '/auth' || path.startsWith('/auth/');
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      user?: JwtUser;
      originalUrl?: string;
      url?: string;
    }>();
    const user = request.user;
    if (!user || user.typ === JWT_TYP.CLIENT) return true;

    const path = requestPath(request);
    if (isAuthPath(path)) return true;

    if (isStudioRoot(user.role) && !user.tenantId) {
      if (isRootConsolePath(path)) return true;
      throw new ForbiddenException('Selecione uma conta para continuar');
    }

    if (
      (user.role === USER_ROLE.ADMIN || user.role === USER_ROLE.OPERATOR) &&
      !user.tenantId
    ) {
      throw new ForbiddenException('Conta sem tenant');
    }

    return true;
  }
}
