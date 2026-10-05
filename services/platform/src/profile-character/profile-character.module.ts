import { Module } from '@nestjs/common';
import { ProfileCharacterService } from './profile-character.service';

@Module({
  providers: [ProfileCharacterService],
  exports: [ProfileCharacterService],
})
export class ProfileCharacterModule {}
