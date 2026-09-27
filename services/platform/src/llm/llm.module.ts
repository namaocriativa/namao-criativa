import { Module } from '@nestjs/common';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { AuthModule } from '../auth/auth.module';
import { EnvStatusService } from './env-status.service';
import { GeminiService } from './gemini.service';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { LlmSettingsService } from './llm-settings.service';

@Module({
  imports: [AuthModule, AiUsageModule],
  controllers: [LlmController],
  providers: [GeminiService, LlmSettingsService, LlmService, EnvStatusService],
  exports: [LlmService, GeminiService, LlmSettingsService],
})
export class LlmModule {}
