import { Body, Controller, Delete, Post } from '@nestjs/common';
import { LeadDiscoveryDto } from './dto/lead-discovery.dto';
import { LeadDiscoveryService } from './lead-discovery.service';
import { StudioAuth } from '../auth/studio-auth.decorator';

@StudioAuth()
@Controller('lead-discovery')
export class LeadDiscoveryController {
  constructor(private readonly leadDiscoveryService: LeadDiscoveryService) {}

  @Post()
  discover(@Body() dto: LeadDiscoveryDto) {
    return this.leadDiscoveryService.discover(dto);
  }

  @Delete('cache')
  clearCache() {
    return this.leadDiscoveryService.clearCache();
  }
}
