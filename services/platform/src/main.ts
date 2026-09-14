import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { createStorageJwtMiddleware } from './auth/storage-jwt.middleware';
import { ChatCorsService } from './public-chat/chat-cors.service';

const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const CORS_HEADERS = ['Content-Type', 'Authorization'];

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=15552000; includeSubDomains',
  );
  next();
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const chatCors = app.get(ChatCorsService);
  app.use(cookieParser());
  app.enableCors((req, callback) => {
    const header = req.headers.origin;
    const origin = typeof header === 'string' ? header : undefined;
    const path = req.path || String(req.url || '').split('?')[0];
    void chatCors
      .isAllowed(origin, path)
      .then((allowed) => {
        callback(null, {
          origin: allowed,
          credentials: true,
          methods: CORS_METHODS,
          allowedHeaders: CORS_HEADERS,
        });
      })
      .catch((error: Error) => callback(error, { origin: false }));
  });

  const serverRoot = join(__dirname, '..');
  app.use(createStorageJwtMiddleware(app.get(JwtService)));
  app.useStaticAssets(join(serverRoot, 'storage'), { prefix: '/storage' });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`namao-api listening on http://localhost:${port}`);
}
void bootstrap();
