import { Module } from '@nestjs/common';
import { CustomerModule } from '../customer/customer.module';
import { LeadModule } from '../lead/lead.module';
import { GithubWebsitesClient } from './github-websites.client';
import { CloudflarePagesClient } from './pages-domain.client';
import { WebsiteProjectsController } from './website-projects.controller';
import { WebsiteProjectsService } from './website-projects.service';

@Module({
  imports: [LeadModule, CustomerModule],
  controllers: [WebsiteProjectsController],
  providers: [WebsiteProjectsService, GithubWebsitesClient, CloudflarePagesClient],
})
export class WebsiteProjectsModule {}
