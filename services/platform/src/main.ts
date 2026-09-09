import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ChatCorsService } from './public-chat/chat-cors.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const chatCors = app.get(ChatCorsService);
  app.enableCors({
    origin: async (origin, callback) => {
      try {
        const allowed = await chatCors.isAllowed(origin);
        callback(null, allowed);
      } catch (error) {
        callback(error as Error, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const serverRoot = join(__dirname, '..');
  app.useStaticAssets(join(serverRoot, 'storage'), { prefix: '/storage' });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`namao-api listening on http://localhost:${port}`);
}
void bootstrap();
