import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtUser } from '../auth/jwt.strategy';
import { DashboardService } from './dashboard.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  analytics(@CurrentUser() user: JwtUser, @Query() query: AnalyticsQueryDto) {
    return this.dashboard.analytics(user, query.range || '7d');
  }
}
