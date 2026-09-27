import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeadActivityModule } from '../lead-activity/lead-activity.module';
import { LlmModule } from '../llm/llm.module';
import { ContentPlanController } from './content-plan.controller';
import { ContentPlanService } from './content-plan.service';

@Module({
  imports: [AuthModule, LlmModule, LeadActivityModule],
  controllers: [ContentPlanController],
  providers: [ContentPlanService],
})
export class ContentPlanModule {}
