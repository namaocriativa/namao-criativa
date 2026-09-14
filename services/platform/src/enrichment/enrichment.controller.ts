import { Body, Controller, Param, Post } from '@nestjs/common';
import { EnrichmentDto } from './dto/enrichment.dto';
import { EnrichmentService } from './enrichment.service';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';
import { StudioLeadAccessService } from '../studio-lead-access/studio-lead-access.service';

@StudioAuth()
@Controller('enrichment')
export class EnrichmentController {
  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly access: StudioLeadAccessService,
  ) {}

  @Post()
  async enrich(@Body() dto: EnrichmentDto, @CurrentUser() user: JwtUser) {
    const lead = await this.enrichmentService.enrich(dto, user);
    return this.access.present(user, lead);
  }

  @Post(':id/refresh')
  async reenrich(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    const lead = await this.enrichmentService.reenrich(id, user);
    return this.access.present(user, lead);
  }
}
