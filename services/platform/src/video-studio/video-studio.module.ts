import { Module } from '@nestjs/common';
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
  imports: [AuthModule, StorageModule, LlmModule],
  controllers: [VideoModelsController, VideoStudioController],
  providers: [GeminiVideoProvider, VideoStudioService],
  exports: [VideoStudioService, GeminiVideoProvider],
})
export class VideoStudioModule {}
