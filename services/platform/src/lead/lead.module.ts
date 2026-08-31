import { Module } from '@nestjs/common';
import { LeadAccountModule } from '../lead-account/lead-account.module';
import { LeadActivityModule } from '../lead-activity/lead-activity.module';
import { LeadMailModule } from '../lead-mail/lead-mail.module';
import { LeadWhatsAppModule } from '../lead-whatsapp/lead-whatsapp.module';
import { StorageModule } from '../storage/storage.module';
import { LeadController } from './lead.controller';
import { LeadService } from './lead.service';

@Module({
  imports: [
    StorageModule,
    LeadAccountModule,
    LeadMailModule,
    LeadWhatsAppModule,
    LeadActivityModule,
  ],
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class LeadModule {}
