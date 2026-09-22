import { Module } from '@nestjs/common';
import { InvitesModule } from '../invites/invites.module';
import { LeadAccountModule } from '../lead-account/lead-account.module';
import { LeadActivityModule } from '../lead-activity/lead-activity.module';
import { MailModule } from '../mail/mail.module';
import { PackagesModule } from '../packages/packages.module';
import { LeadMailService } from './lead-mail.service';

@Module({
  imports: [
    InvitesModule,
    LeadAccountModule,
    LeadActivityModule,
    PackagesModule,
    MailModule,
  ],
  providers: [LeadMailService],
  exports: [LeadMailService],
})
export class LeadMailModule {}
