import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';
import { DashboardService } from './dashboard.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('analytics')
  analytics(@CurrentUser() user: JwtUser, @Query() query: AnalyticsQueryDto) {
    return this.dashboard.analytics(user, query.range || '7d');
  }

  @Get('calendar')
  calendar(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.calendar(user, from, to);
  }
}
