import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtUser } from './jwt.strategy';
import { IS_PUBLIC_KEY } from './public.decorator';
import { hasStudioPermission, type StudioPermissionName } from './roles';
import { STUDIO_PERMISSION_KEY } from './studio-permission.decorator';

@Injectable()
export class StudioPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const permission = this.reflector.getAllAndOverride<
      StudioPermissionName | StudioPermissionName[]
    >(STUDIO_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!permission) return true;
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const required = Array.isArray(permission) ? permission : [permission];
    return required.some((item) => hasStudioPermission(request.user, item));
  }
}
