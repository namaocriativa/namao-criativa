import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';
import { CreateInviteDto } from './dto/create-invite.dto';
import { SendInstagramPermissionDto } from './dto/send-instagram-permission.dto';
import { InvitesService } from './invites.service';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';
import { ownerIdOf } from '../owner/owner.util';

@StudioAuth()
@Controller('invites')
export class InvitesController {
  constructor(
    private readonly invitesService: InvitesService,
    private readonly access: StudioLeadAccessService,
  ) {}

  @Post()
  async create(@Body() dto: CreateInviteDto, @CurrentUser() user: JwtUser) {
    await this.access.assertCanAccess(user, dto.leadId);
    return this.invitesService.create(dto);
  }

  @Post('instagram-permission')
  async sendInstagramPermission(
    @Body() dto: SendInstagramPermissionDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.access.assertCanAccess(user, dto.leadId);
    return this.invitesService.sendInstagramPermission(dto.leadId);
  }

  @Public()
  @Get(':token')
  getPublic(@Param('token') token: string) {
    return this.invitesService.getPublic(token);
  }

  @Post(':id/send-whatsapp')
  async sendWhatsApp(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const invite = await this.invitesService.getStudioInvite(id);
    const profileId = ownerIdOf(invite);
    if (!profileId) {
      throw new NotFoundException('Convite não encontrado');
    }
    await this.access.assertCanAccess(user, profileId);
    return this.invitesService.sendWhatsApp(id);
  }
}
