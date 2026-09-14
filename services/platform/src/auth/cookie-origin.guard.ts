import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { assertCookieOrigin } from './cookie-origin';
import { inspectJwtFromRequest } from './jwt-cookie';

@Injectable()
export class CookieOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
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
