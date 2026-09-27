import { Module } from '@nestjs/common';
import { AiUsageModule } from '../ai-usage/ai-usage.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { StudioUsersController } from './studio-users.controller';
import { StudioUsersService } from './studio-users.service';

@Module({
  imports: [AuthModule, MailModule, AiUsageModule],
  controllers: [StudioUsersController],
  providers: [StudioUsersService],
})
export class StudioUsersModule {}
