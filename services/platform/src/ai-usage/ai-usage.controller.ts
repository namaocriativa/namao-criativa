import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { USER_ROLE } from '../auth/roles';
import { periodKey } from './ai-usage.period';
import { AiUsageService } from './ai-usage.service';
import { SaveAiBudgetsDto } from './dto/save-ai-budgets.dto';
import { SaveAiPricingDto } from './dto/save-ai-pricing.dto';

@Controller('studio')
@Roles(USER_ROLE.ROOT)
export class AiUsageController {
  constructor(private readonly usage: AiUsageService) {}

  @Get('ai/pricing')
  pricing() {
    return this.usage.pricingPayload();
  }

  @Put('ai/pricing')
  async savePricing(@Body() dto: SaveAiPricingDto) {
    if (dto.usdToBrl != null) {
      await this.usage.saveFx(dto.usdToBrl);
    }
    if (dto.rows?.length) {
      return this.usage.savePriceRows(dto.rows);
    }
    return this.usage.pricingPayload();
  }

  @Get('tenants/:id/usage')
  usageForTenant(
    @Param('id') id: string,
    @Query('period') period?: string,
  ) {
    return this.usage.tenantUsage(id, period?.trim() || periodKey());
  }

  @Get('tenants/:id/usage/budgets')
  budgets(@Param('id') id: string) {
    return this.usage.listBudgets(id);
  }

  @Put('tenants/:id/usage/budgets')
  saveBudgets(@Param('id') id: string, @Body() dto: SaveAiBudgetsDto) {
    return this.usage.saveBudgets(id, dto.items);
  }
}
