import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

const APP_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const extraOrigin = process.env.NAMAO_PUBLIC_URL?.replace(/\/$/, '') || '';
  const allowed = new Set(
    [...APP_CORS_ORIGINS, extraOrigin].filter(Boolean),
  );
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowed.has(origin.replace(/\/$/, ''))) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });

  const serverRoot = join(__dirname, '..');
  app.useStaticAssets(join(serverRoot, 'storage'), { prefix: '/storage' });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`discovery-lead-enrichment listening on http://localhost:${port}`);
}
bootstrap();
