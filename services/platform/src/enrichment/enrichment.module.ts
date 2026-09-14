import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeadAccountModule } from '../lead-account/lead-account.module';
import { ProvidersModule } from '../providers/providers.module';
import { StorageModule } from '../storage/storage.module';
import { EnrichmentController } from './enrichment.controller';
import { EnrichmentService } from './enrichment.service';
import { LeadMergerService } from './lead-merger.service';

@Module({
  imports: [AuthModule, ProvidersModule, StorageModule, LeadAccountModule],
  controllers: [EnrichmentController],
  providers: [EnrichmentService, LeadMergerService],
})
export class EnrichmentModule {}
