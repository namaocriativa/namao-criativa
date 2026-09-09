import { Module } from '@nestjs/common';
import { LeadAccountModule } from '../lead-account/lead-account.module';
import { LeadActivityModule } from '../lead-activity/lead-activity.module';
import { LeadMailModule } from '../lead-mail/lead-mail.module';
import { LeadWhatsAppModule } from '../lead-whatsapp/lead-whatsapp.module';
import { StorageModule } from '../storage/storage.module';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

@Module({
  imports: [
    StorageModule,
    LeadAccountModule,
    LeadMailModule,
    LeadWhatsAppModule,
    LeadActivityModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
