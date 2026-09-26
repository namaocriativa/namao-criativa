import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { OwnerModule } from '../owner/owner.module';
import { StorageModule } from '../storage/storage.module';
import { WebsiteProjectsModule } from '../website-projects/website-projects.module';
import { SiteSkillController } from './site-skill.controller';
import { SiteSkillService } from './site-skill.service';

@Module({
  imports: [
    AuthModule,
    LlmModule,
    OwnerModule,
    StorageModule,
    WebsiteProjectsModule,
  ],
  controllers: [SiteSkillController],
  providers: [SiteSkillService],
})
export class SiteSkillModule {}
