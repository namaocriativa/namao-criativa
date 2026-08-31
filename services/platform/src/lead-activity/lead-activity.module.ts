import { Module } from '@nestjs/common';
import { LeadActivityService } from './lead-activity.service';

@Module({
  providers: [LeadActivityService],
  exports: [LeadActivityService],
})
export class LeadActivityModule {}
