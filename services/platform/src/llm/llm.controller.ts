import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { UpdateLlmSettingsDto } from './dto/update-llm-settings.dto';
import { LlmService } from './llm.service';
import { LLM_ROLES } from './llm.types';

@Controller('config')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Get('llm')
  getLlm() {
    return this.llmService.configPayload();
  }

  @Put('llm')
  async putLlm(@Body() dto: UpdateLlmSettingsDto) {
    const usesGemini = LLM_ROLES.some(
      (role) => dto.roles[role].provider === 'gemini',
    );
    if (usesGemini && !this.llmService.geminiConfigured()) {
      throw new BadRequestException(
        'GEMINI_API_KEY não configurada no .env. Obtenha em https://aistudio.google.com/apikey',
      );
    }
    const settings = await this.llmService.saveSettings(dto);
    const payload = await this.llmService.configPayload();
    return { ...payload, settings };
  }
}
