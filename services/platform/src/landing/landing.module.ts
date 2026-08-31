import { Module } from '@nestjs/common';
import { LeadModule } from '../lead/lead.module';
import { LlmModule } from '../llm/llm.module';
import { StorageModule } from '../storage/storage.module';
import { LandingController } from './landing.controller';
import { LandingJobsService } from './landing-jobs.service';
import { LandingLocalService } from './landing-local.service';
import { LandingPipelineService } from './landing-pipeline.service';
import { LandingService } from './landing.service';
import { PexelsService } from './pexels.service';
import { ScaffoldService } from './scaffold.service';
import { ScreenshotService } from './screenshot.service';
import { VercelService } from './vercel.service';

@Module({
  imports: [LeadModule, LlmModule, StorageModule],
  controllers: [LandingController],
  providers: [
    LandingService,
    LandingPipelineService,
    ScaffoldService,
    LandingJobsService,
    LandingLocalService,
    ScreenshotService,
    VercelService,
    PexelsService,
  ],
})
export class LandingModule {}
