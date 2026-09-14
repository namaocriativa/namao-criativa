import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { assertCookieOrigin } from './cookie-origin';
import { inspectJwtFromRequest } from './jwt-cookie';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class CookieOriginGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const inspected = inspectJwtFromRequest(req);
    if (!inspected) return true;
    assertCookieOrigin(req, inspected.source, {
      studioUrl: this.config.get<string>('NAMAO_STUDIO_URL'),
      publicUrl: this.config.get<string>('NAMAO_PUBLIC_URL'),
    });
    return true;
  }
}
