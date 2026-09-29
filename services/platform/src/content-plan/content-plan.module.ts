import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CalendarModule } from '../calendar/calendar.module';
import { CreativeStudioModule } from '../creative-studio/creative-studio.module';
import { ImageStudioModule } from '../image-studio/image-studio.module';
import { LeadActivityModule } from '../lead-activity/lead-activity.module';
import { LlmModule } from '../llm/llm.module';
import { VideoStudioModule } from '../video-studio/video-studio.module';
import { ContentPlanController } from './content-plan.controller';
import { ContentPlanService } from './content-plan.service';

@Module({
  imports: [
    AuthModule,
    LlmModule,
    LeadActivityModule,
    CalendarModule,
    CreativeStudioModule,
    ImageStudioModule,
    VideoStudioModule,
  ],
  controllers: [ContentPlanController],
  providers: [ContentPlanService],
})
export class ContentPlanModule {}
