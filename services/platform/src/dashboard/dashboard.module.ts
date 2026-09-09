import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Ga4Client } from './ga4.client';

@Module({
  imports: [AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService, Ga4Client],
})
export class DashboardModule {}
