import { Module } from '@nestjs/common';
import { OllamaService } from '../landing/ollama.service';
import { GeminiService } from './gemini.service';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { LlmSettingsService } from './llm-settings.service';

@Module({
  controllers: [LlmController],
  providers: [OllamaService, GeminiService, LlmSettingsService, LlmService],
  exports: [LlmService, OllamaService, GeminiService, LlmSettingsService],
})
export class LlmModule {}
