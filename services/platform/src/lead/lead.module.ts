import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeadAccountModule } from '../lead-account/lead-account.module';
import { LeadActivityModule } from '../lead-activity/lead-activity.module';
import { LeadMailModule } from '../lead-mail/lead-mail.module';
import { LeadWhatsAppModule } from '../lead-whatsapp/lead-whatsapp.module';
import { ProposalModule } from '../proposal/proposal.module';
import { StorageModule } from '../storage/storage.module';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';

@Module({
  imports: [
    AuthModule,
    StorageModule,
    LeadAccountModule,
    LeadMailModule,
    LeadWhatsAppModule,
    LeadActivityModule,
    ProposalModule,
  ],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule {}
