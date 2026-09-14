import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { CreateInviteDto } from './dto/create-invite.dto';
import { SendInstagramPermissionDto } from './dto/send-instagram-permission.dto';
import { InvitesService } from './invites.service';

@StudioAuth()
@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  create(@Body() dto: CreateInviteDto) {
    return this.invitesService.create(dto);
  }

  @Post('instagram-permission')
  sendInstagramPermission(@Body() dto: SendInstagramPermissionDto) {
    return this.invitesService.sendInstagramPermission(dto.leadId);
  }

  @Public()
  @Get(':token')
  getPublic(@Param('token') token: string) {
    return this.invitesService.getPublic(token);
  }

  @Post(':id/send-whatsapp')
  sendWhatsApp(@Param('id') id: string) {
    return this.invitesService.sendWhatsApp(id);
  }
}
