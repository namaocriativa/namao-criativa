import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import type { JwtUser } from '../auth/jwt.strategy';
import { isStudioRole } from '../auth/roles';
import {
  describeStudioAction,
  normalizeStudioPath,
  shouldSkipStudioActivityPath,
} from './studio-activity.describe';
import { StudioActivityService } from './studio-activity.service';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class StudioActivityInterceptor implements NestInterceptor {
  constructor(private readonly activity: StudioActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: JwtUser }
    >();
    const method = (req.method || '').toUpperCase();
    const path = normalizeStudioPath(req.path || req.originalUrl || '/');
    if (!MUTATING.has(method) || shouldSkipStudioActivityPath(path)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const user = req.user;
        if (!user?.id || !isStudioRole(user.role)) return;
        const described = describeStudioAction(method, path);
        void this.activity.record({
          userId: user.id,
          method,
          path,
          kind: described.kind,
          title: described.title,
          summary: described.summary,
          payload: safeParams(req.params),
        });
      }),
    );
  }
}

function safeParams(
  params: Request['params'] | undefined,
): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (/password|token|secret|authorization/i.test(key)) continue;
    if (typeof value === 'string' && value) payload[key] = value;
  }
  return Object.keys(payload).length ? payload : undefined;
}
