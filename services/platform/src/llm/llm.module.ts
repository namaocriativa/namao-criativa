import { Module } from '@nestjs/common';
import { EnvStatusService } from './env-status.service';
import { GeminiService } from './gemini.service';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { LlmSettingsService } from './llm-settings.service';

@Module({
  controllers: [LlmController],
  providers: [GeminiService, LlmSettingsService, LlmService, EnvStatusService],
  exports: [LlmService, GeminiService, LlmSettingsService],
})
export class LlmModule {}
