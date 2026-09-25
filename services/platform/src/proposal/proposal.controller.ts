import { Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';
import { Roles } from '../auth/roles.decorator';
import { USER_ROLE } from '../auth/roles';
import { ProposalService } from './proposal.service';

@Roles(USER_ROLE.CLIENT)
@Controller('proposal')
export class ProposalController {
  constructor(private readonly proposals: ProposalService) {}

  @Get()
  get(@CurrentUser() user: JwtUser) {
    return this.proposals.getForClient(user);
  }

  @Post('accept')
  accept(@CurrentUser() user: JwtUser) {
    return this.proposals.accept(user);
  }
}
