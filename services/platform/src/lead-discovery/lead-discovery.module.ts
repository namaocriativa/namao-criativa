import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { ProvidersModule } from '../providers/providers.module';
import { LeadDiscoveryController } from './lead-discovery.controller';
import { LeadDiscoveryService } from './lead-discovery.service';

@Module({
  imports: [ProvidersModule, LocationsModule],
  controllers: [LeadDiscoveryController],
  providers: [LeadDiscoveryService],
})
export class LeadDiscoveryModule {}
