import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { JwtUser } from '../auth/jwt.strategy';
import { StudioLeadAccessService } from './studio-lead-access.service';

@Injectable()
export class StudioProfileAccessGuard implements CanActivate {
  constructor(private readonly access: StudioLeadAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: JwtUser;
      params?: { id?: string };
    }>();
    const user = request.user;
    const id = request.params?.id;
    if (!user || !id) return true;
    await this.access.assertCanAccess(user, id);
    return true;
  }
}
