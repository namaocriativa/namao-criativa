import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CreatePublicChatSessionDto,
  PublicChatEventDto,
  PublicChatMessageDto,
} from './dto/public-chat.dto';
import { PublicChatService } from './public-chat.service';

@Controller('public')
export class PublicChatController {
  constructor(private readonly chat: PublicChatService) {}

  @Post('chat/session')
  async createSession(
    @Req() req: Request,
    @Body() dto: CreatePublicChatSessionDto,
  ) {
    const created = await this.chat.createSession(req, dto.siteId);
    return {
      sessionId: created.sessionId,
      sessionToken: created.sessionToken,
      expiresAt: created.expiresAt,
    };
  }

  @Post('chat')
  async chatMessage(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: PublicChatMessageDto,
  ) {
    await this.chat.streamChat(req, res, {
      sessionId: dto.sessionId,
      message: dto.message,
    });
  }

  @Post('chat/events')
  @HttpCode(204)
  async events(@Req() req: Request, @Body() dto: PublicChatEventDto) {
    await this.chat.recordEvent(req, dto.name, dto.payload);
  }
}
