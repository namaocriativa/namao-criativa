import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { EnrichmentModule } from './enrichment/enrichment.module';
import { LeadModule } from './lead/lead.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
    }),
    PrismaModule,
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
    LandingModule,
    PackagesModule,
  ],
})
export class AppModule {}
