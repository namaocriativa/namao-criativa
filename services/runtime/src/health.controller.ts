import { Controller, Get } from '@nestjs/common';
import { GeminiService } from './gemini/gemini.service';

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
