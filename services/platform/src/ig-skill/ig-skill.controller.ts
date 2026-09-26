import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { IgSkillService } from './ig-skill.service';

@StudioAuth()
@Controller('ig-skill')
export class IgSkillController {
  constructor(private readonly skill: IgSkillService) {}

  @Get('estimate')
  estimate(@Query('model') model?: string) {
    return this.skill.estimate(model);
  }

  @Get('latest')
  latest(
    @Query('leadId') leadId?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.skill.latest(leadId, customerId);
  }

  @Get('jobs/:id')
  job(@Param('id') id: string) {
    return this.skill.findJob(id);
  }

  @Post('analyze')
  analyze(
    @CurrentUser() user: JwtUser,
    @Body()
    body: {
      leadId?: string;
      customerId?: string;
      model?: string;
      notes?: string;
      days?: number;
    },
  ) {
    return this.skill.start({
      user,
      leadId: body.leadId,
      customerId: body.customerId,
      model: body.model,
      notes: body.notes,
      days: body.days,
    });
  }
}
