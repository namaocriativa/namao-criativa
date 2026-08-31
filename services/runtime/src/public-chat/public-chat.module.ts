import { Module } from '@nestjs/common';
import { GeminiModule } from '../gemini/gemini.module';
import { ChatCorsService } from './chat-cors.service';
import { ChatContextBuilder } from './context-builder';
import { PublicChatController } from './public-chat.controller';
import { PublicChatService } from './public-chat.service';
import { ChatRateLimitService } from './rate-limit.service';
import { ChatSessionService } from './session.service';
import { SiteResolver } from './site-resolver';

@Module({
  imports: [GeminiModule],
  controllers: [PublicChatController],
  providers: [
    ChatCorsService,
    ChatContextBuilder,
    ChatRateLimitService,
    ChatSessionService,
    SiteResolver,
    PublicChatService,
  ],
  exports: [ChatCorsService],
})
export class PublicChatModule {}
