import { Module } from '@nestjs/common';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { StorageModule } from '../storage/storage.module';
import { GeminiVideoProvider } from './gemini-video.provider';
import {
  VideoModelsController,
  VideoStudioController,
} from './video-studio.controller';
import { VideoStudioService } from './video-studio.service';

@Module({
  imports: [AuthModule, StorageModule, LlmModule, AiUsageModule],
  controllers: [VideoModelsController, VideoStudioController],
  providers: [GeminiVideoProvider, VideoStudioService],
  exports: [VideoStudioService, GeminiVideoProvider],
})
export class VideoStudioModule {}
