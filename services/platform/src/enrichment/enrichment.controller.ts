import { Body, Controller, Param, Post } from '@nestjs/common';
import { EnrichmentDto } from './dto/enrichment.dto';
import { EnrichmentService } from './enrichment.service';
import { StudioAuth } from '../auth/studio-auth.decorator';

@StudioAuth()
@Controller('enrichment')
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @Post()
  enrich(@Body() dto: EnrichmentDto) {
    return this.enrichmentService.enrich(dto);
  }

  @Post(':id/refresh')
  reenrich(@Param('id') id: string) {
    return this.enrichmentService.reenrich(id);
  }
}
