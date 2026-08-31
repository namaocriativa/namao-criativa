import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CreateInviteRequestDto } from './dto/create-invite-request.dto';
import { InviteRequestsService } from './invite-requests.service';

@Controller('invite-requests')
export class InviteRequestsController {
  constructor(private readonly invites: InviteRequestsService) {}

  @Post()
  @HttpCode(201)
  create(@Req() req: Request, @Body() dto: CreateInviteRequestDto) {
    return this.invites.create(req, dto);
  }
}
