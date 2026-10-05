import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MAX_VIDEO_TAKES, MIN_VIDEO_TAKES } from '../video-livre.planner';

function toOptionalBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return Boolean(value);
}

export class RefineVideoLivreDto {
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  brief!: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  videoHookId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  planModel?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  noCharacterVoice?: boolean;
}

export class BreakVideoLivreDto {
  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  script!: string;

  @Type(() => Number)
  @IsInt()
  @Min(MIN_VIDEO_TAKES)
  @Max(MAX_VIDEO_TAKES)
  takeCount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  videoHookId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  planModel?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  noCharacterVoice?: boolean;
}

export class CreateVideoLivreClipDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  brief?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  characterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  characterAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  videoHookId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  resolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  thinkingLevel?: string;

  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  noCharacterVoice?: boolean;
}

export class GenerateVideoLivreClipDto extends CreateVideoLivreClipDto {}
