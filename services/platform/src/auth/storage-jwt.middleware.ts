import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';
import { extractJwtFromRequest } from './jwt-cookie';
import { isStudioRole } from './roles';

export function createStorageJwtMiddleware(jwt: JwtService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || req.path).split('?')[0];
    if (!path.startsWith('/storage')) {
      next();
      return;
    }
    const token = extractJwtFromRequest(req);
    if (!token) {
      res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
      return;
    }
    try {
      const payload = jwt.verify<{ role?: string }>(token);
      if (!isStudioRole(payload.role)) {
        res.status(403).json({ statusCode: 403, message: 'Forbidden' });
        return;
      }
      next();
    } catch {
      res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
    }
  };
}
