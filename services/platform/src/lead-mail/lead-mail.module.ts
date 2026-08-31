import { Module } from '@nestjs/common';
import { InvitesModule } from '../invites/invites.module';
import { LeadAccountModule } from '../lead-account/lead-account.module';
import { LeadActivityModule } from '../lead-activity/lead-activity.module';
import { LeadMailService } from './lead-mail.service';

@Module({
  imports: [InvitesModule, LeadAccountModule, LeadActivityModule],
  providers: [LeadMailService],
  exports: [LeadMailService],
})
export class LeadMailModule {}
