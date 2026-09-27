import { Module } from '@nestjs/common';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { LeadActivityService } from './lead-activity.service';

@Module({
  imports: [AiUsageModule],
  providers: [LeadActivityService],
  exports: [LeadActivityService],
})
export class LeadActivityModule {}
