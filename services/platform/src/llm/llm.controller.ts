import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { UpdateLlmSettingsDto } from './dto/update-llm-settings.dto';
import { EnvStatusService } from './env-status.service';
import { LlmService } from './llm.service';

@Controller('config')
export class LlmController {
  constructor(
    private readonly llmService: LlmService,
    private readonly envStatus: EnvStatusService,
  ) {}

  @Get('llm')
  getLlm() {
    return this.llmService.configPayload();
  }

  @Get('env')
  getEnv() {
    return this.envStatus.list();
  }

  @Put('llm')
  async putLlm(@Body() dto: UpdateLlmSettingsDto) {
    if (!this.llmService.geminiConfigured()) {
      throw new BadRequestException(
        'GEMINI_API_KEY não configurada no .env. Obtenha em https://aistudio.google.com/apikey',
      );
    }
    const settings = await this.llmService.saveSettings(dto);
    const payload = await this.llmService.configPayload();
    return { ...payload, settings };
  }
}
