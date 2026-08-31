import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { LeadAccountService } from './lead-account.service';

@Module({
  imports: [MailModule],
  providers: [LeadAccountService],
  exports: [LeadAccountService],
})
export class LeadAccountModule {}
