import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { CustomerModule } from './customer/customer.module';
import { LeadModule } from './lead/lead.module';
import { OwnerModule } from './owner/owner.module';
import { LeadDiscoveryModule } from './lead-discovery/lead-discovery.module';
import { LocationsModule } from './locations/locations.module';
import { LandingModule } from './landing/landing.module';
import { AuthModule } from './auth/auth.module';
import { InvitesModule } from './invites/invites.module';
import { InstagramModule } from './instagram/instagram.module';
import { LlmModule } from './llm/llm.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProvidersModule } from './providers/providers.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { PackagesModule } from './packages/packages.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';
import { InviteRequestsModule } from './invite-requests/invite-requests.module';
import { PublicChatModule } from './public-chat/public-chat.module';
import { NamaoChatModule } from './namao-chat/namao-chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
    }),
    PrismaModule,
    OwnerModule,
    RedisModule,
    StorageModule,
    LlmModule,
    AuthModule,
    InvitesModule,
    InstagramModule,
    ProvidersModule,
    LocationsModule,
    LeadDiscoveryModule,
    EnrichmentModule,
    LeadModule,
    CustomerModule,
    LandingModule,
    PackagesModule,
    PublicChatModule,
    NamaoChatModule,
    InviteRequestsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
