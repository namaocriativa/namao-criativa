import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstagramModule } from '../instagram/instagram.module';
import { LlmModule } from '../llm/llm.module';
import { OwnerModule } from '../owner/owner.module';
import { IgSkillController } from './ig-skill.controller';
import { IgSkillService } from './ig-skill.service';

@Module({
  imports: [AuthModule, LlmModule, OwnerModule, InstagramModule],
  controllers: [IgSkillController],
  providers: [IgSkillService],
})
export class IgSkillModule {}
