import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { ChatRateLimitService } from '../public-chat/rate-limit.service';
import { NamaoChatController } from './namao-chat.controller';
import { NamaoChatService } from './namao-chat.service';

@Module({
  imports: [AuthModule, LlmModule],
  controllers: [NamaoChatController],
  providers: [NamaoChatService, ChatRateLimitService],
})
export class NamaoChatModule {}
