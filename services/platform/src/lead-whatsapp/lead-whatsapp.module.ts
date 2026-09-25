import { Module } from '@nestjs/common';
import { EvolutionModule } from '../evolution/evolution.module';
import { InvitesModule } from '../invites/invites.module';
import { LeadAccountModule } from '../lead-account/lead-account.module';
import { LeadActivityModule } from '../lead-activity/lead-activity.module';
import { PackagesModule } from '../packages/packages.module';
import { ProposalModule } from '../proposal/proposal.module';
import { LeadWhatsAppService } from './lead-whatsapp.service';

@Module({
  imports: [
    EvolutionModule,
    InvitesModule,
    LeadAccountModule,
    LeadActivityModule,
    PackagesModule,
    ProposalModule,
  ],
  providers: [LeadWhatsAppService],
  exports: [LeadWhatsAppService],
})
export class LeadWhatsAppModule {}
