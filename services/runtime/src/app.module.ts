import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { GeminiModule } from './gemini/gemini.module';
import { HealthController } from './health.controller';
import { InviteRequestsModule } from './invite-requests/invite-requests.module';
import { MongoPrismaModule } from './mongo/mongo-prisma.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicChatModule } from './public-chat/public-chat.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
    }),
    PrismaModule,
    MongoPrismaModule,
    RedisModule,
    GeminiModule,
    PublicChatModule,
    InviteRequestsModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
