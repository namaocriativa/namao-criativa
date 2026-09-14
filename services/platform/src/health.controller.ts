import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';
import { GeminiService } from './llm/gemini.service';

@Public()
@Controller()
export class HealthController {
  constructor(private readonly gemini: GeminiService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      geminiConfigured: this.gemini.configured,
    };
  }
}
