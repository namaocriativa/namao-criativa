import { Global, Module } from '@nestjs/common';
import { StudioLeadAccessService } from './studio-lead-access.service';
import { StudioLeadShareService } from './studio-lead-share.service';
import { StudioProfileAccessGuard } from './studio-profile-access.guard';

@Global()
@Module({
  providers: [
    StudioLeadAccessService,
    StudioLeadShareService,
    StudioProfileAccessGuard,
  ],
  exports: [
    StudioLeadAccessService,
    StudioLeadShareService,
    StudioProfileAccessGuard,
  ],
})
export class StudioLeadAccessModule {}
