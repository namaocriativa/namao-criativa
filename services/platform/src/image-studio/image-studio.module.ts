import { Module } from '@nestjs/common';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { StorageModule } from '../storage/storage.module';
import { GeminiImageProvider } from './gemini-image.provider';
import {
  ImageModelsController,
  ImageStudioController,
} from './image-studio.controller';
import { ImageStudioService } from './image-studio.service';

@Module({
  imports: [AuthModule, StorageModule, LlmModule, AiUsageModule],
  controllers: [ImageModelsController, ImageStudioController],
  providers: [GeminiImageProvider, ImageStudioService],
  exports: [ImageStudioService, GeminiImageProvider],
})
export class ImageStudioModule {}
