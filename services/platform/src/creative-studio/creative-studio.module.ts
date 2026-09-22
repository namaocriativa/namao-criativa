import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ImageStudioModule } from '../image-studio/image-studio.module';
import { LeadModule } from '../lead/lead.module';
import { LlmModule } from '../llm/llm.module';
import { PackagesModule } from '../packages/packages.module';
import { StorageModule } from '../storage/storage.module';
import { VideoStudioModule } from '../video-studio/video-studio.module';
import { CreativeToolGateway } from './agent-tool.gateway';
import { CreativeAgentController } from './creative-agent.controller';
import { CreativeAgentService } from './creative-agent.service';
import { CreativeCharacterController } from './creative-character.controller';
import { CreativeCharacterService } from './creative-character.service';
import { CreativeMovieController } from './creative-movie.controller';
import { CreativeMovieService } from './creative-movie.service';
import { CreativeStartEndController } from './creative-start-end.controller';
import { CreativeStartEndService } from './creative-start-end.service';
import { CreativeUgcController } from './creative-ugc.controller';
import { CreativeUgcService } from './creative-ugc.service';
import { CreativeStudioController } from './creative-studio.controller';
import { CreativeStudioService } from './creative-studio.service';

@Module({
  imports: [
    AuthModule,
    LlmModule,
    LeadModule,
    PackagesModule,
    ImageStudioModule,
    VideoStudioModule,
    StorageModule,
  ],
  controllers: [
    CreativeStudioController,
    CreativeCharacterController,
    CreativeMovieController,
    CreativeStartEndController,
    CreativeUgcController,
    CreativeAgentController,
  ],
  providers: [
    CreativeStudioService,
    CreativeCharacterService,
    CreativeMovieService,
    CreativeStartEndService,
    CreativeUgcService,
    CreativeToolGateway,
    CreativeAgentService,
  ],
  exports: [
    CreativeStudioService,
    CreativeCharacterService,
    CreativeMovieService,
    CreativeStartEndService,
    CreativeUgcService,
    CreativeAgentService,
  ],
})
export class CreativeStudioModule {}
