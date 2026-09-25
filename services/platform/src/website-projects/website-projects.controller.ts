import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/jwt.strategy';
import { StudioAuth } from '../auth/studio-auth.decorator';
import {
  LinkWebsiteDto,
  SyncWebsiteDomainDto,
} from './dto/link-website.dto';
import { WebsiteProjectsService } from './website-projects.service';

@StudioAuth()
@Controller()
export class WebsiteProjectsController {
  constructor(private readonly websites: WebsiteProjectsService) {}

  @Get('website-projects')
  list() {
    return this.websites.list();
  }

  @Post('leads/:id/website')
  linkLead(
    @Param('id') id: string,
    @Body() dto: LinkWebsiteDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.websites.linkLead(id, dto, user);
  }

  @Post('customers/:id/website')
  linkCustomer(
    @Param('id') id: string,
    @Body() dto: LinkWebsiteDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.websites.linkCustomer(id, dto, user);
  }

  @Get('leads/:id/website/health')
  healthLead(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.websites.healthLead(id, user);
  }

  @Get('customers/:id/website/health')
  healthCustomer(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.websites.healthCustomer(id, user);
  }

  @Post('leads/:id/website/domain/sync')
  syncLeadDomain(
    @Param('id') id: string,
    @Body() dto: SyncWebsiteDomainDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.websites.syncLeadDomain(id, dto, user);
  }

  @Post('customers/:id/website/domain/sync')
  syncCustomerDomain(
    @Param('id') id: string,
    @Body() dto: SyncWebsiteDomainDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.websites.syncCustomerDomain(id, dto, user);
  }

  @Post('leads/:id/website/deploy')
  deployLead(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.websites.deployLead(id, user);
  }

  @Post('customers/:id/website/deploy')
  deployCustomer(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.websites.deployCustomer(id, user);
  }
}
