import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { ContentPlanService } from './content-plan.service';
import { GenerateContentPlanDto } from './dto/generate-content-plan.dto';

@StudioAuth()
@Controller('content-plan')
export class ContentPlanController {
  constructor(private readonly plans: ContentPlanService) {}

  @Get('open')
  open(
    @CurrentUser() user: JwtUser,
    @Query('leadId') leadId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.plans.open(user, leadId, customerId);
  }

  @Post('generate')
  generate(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateContentPlanDto,
  ) {
    return this.plans.generate(dto, user);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.plans.confirm(id, user);
  }

  @Post(':id/discard')
  discard(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.plans.discard(id, user);
  }
}
