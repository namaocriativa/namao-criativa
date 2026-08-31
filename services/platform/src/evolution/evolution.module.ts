import { Module } from '@nestjs/common';
import { EvolutionClient } from './evolution.client';

@Module({
  providers: [EvolutionClient],
  exports: [EvolutionClient],
})
export class EvolutionModule {}
