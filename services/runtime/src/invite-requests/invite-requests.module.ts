import { Module } from '@nestjs/common';
import { InviteRateLimitService } from './invite-rate-limit.service';
import { InviteRequestsController } from './invite-requests.controller';
import { InviteRequestsService } from './invite-requests.service';

@Module({
  controllers: [InviteRequestsController],
  providers: [InviteRateLimitService, InviteRequestsService],
})
export class InviteRequestsModule {}
