import { Public } from '../auth/public.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CreateNamaoChatSessionDto,
  NamaoChatEventDto,
  NamaoChatMessageDto,
} from './dto/namao-chat.dto';
import { NamaoChatService } from './namao-chat.service';

@Public()
@Controller('namao-chat')
export class NamaoChatController {
  constructor(private readonly chat: NamaoChatService) {}

  @Post('session')
  createSession(@Req() req: Request, @Body() dto: CreateNamaoChatSessionDto) {
    return this.chat.createSession(req, dto.guestSessionToken);
  }

  @Get('history')
  history(@Req() req: Request) {
    return this.chat.history(req);
  }

  @Post()
  chatMessage(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: NamaoChatMessageDto,
  ) {
    return this.chat.streamChat(req, res, {
      sessionId: dto.sessionId,
      message: dto.message,
    });
  }

  @Post('events')
  @HttpCode(204)
  events(@Req() req: Request, @Body() dto: NamaoChatEventDto) {
    return this.chat.recordEvent(req, dto.name, dto.payload);
  }
}
