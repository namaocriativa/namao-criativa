import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_VIDEO_TAKES, MIN_VIDEO_TAKES } from '../content-plan.contract';

export class BreakContentPlanTakesDto {
  @Type(() => Number)
  @IsInt()
  @Min(MIN_VIDEO_TAKES)
  @Max(MAX_VIDEO_TAKES)
  takeCount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  planModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  videoHookId?: string;
}
