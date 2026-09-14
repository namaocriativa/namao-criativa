import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';
import { Public } from '../auth/public.decorator';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { jwtOwnerId } from '../owner/owner.util';
import { InstagramService } from './instagram.service';

@Controller()
export class InstagramController {
  constructor(private readonly instagram: InstagramService) {}

  @Get('auth/instagram/start')
  async start(@CurrentUser() user: JwtUser) {
    const url = await this.instagram.startUrl(user);
    return { url };
  }

  @Public()
  @Get('auth/instagram/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const url = await this.instagram.handleCallback(code, state);
    return res.redirect(url);
  }

  @Get('auth/instagram/status')
  status(@CurrentUser() user: JwtUser) {
    return this.instagram.connectionForUser(user);
  }

  @Post('auth/instagram/sync')
  syncMine(@CurrentUser() user: JwtUser) {
    if (!jwtOwnerId(user)) {
      return { imported: 0, error: 'no_lead' };
    }
    return this.instagram.syncLead(jwtOwnerId(user)!, user);
  }

  @Post('leads/:id/instagram/sync')
  @StudioAuth()
  syncLead(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.instagram.syncLead(id, user);
  }
}
