import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvolutionModule } from '../evolution/evolution.module';
import { MailModule } from '../mail/mail.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [AuthModule, EvolutionModule, MailModule],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
