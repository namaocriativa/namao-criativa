import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CONTENT_PLAN_MIX_MODES,
  CONTENT_PLAN_OBJECTIVES,
  CONTENT_PLAN_TONES,
} from '../content-plan.contract';
import {
  CONTENT_PLAN_FORMATS,
  MAX_PLAN_WEEKS,
  MAX_POSTS_PER_WEEK,
  MIN_PLAN_WEEKS,
  MIN_POSTS_PER_WEEK,
} from '../content-plan.planner';

export class GenerateContentPlanDto {
  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsIn(CONTENT_PLAN_OBJECTIVES, { each: true })
  objectives!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(400)
  goalNote?: string;

  @IsOptional()
  @IsArray()
  @IsIn(CONTENT_PLAN_TONES, { each: true })
  tones?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  promote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  avoid?: string;

  @IsOptional()
  @IsObject()
  contextOverrides?: {
    segment?: string;
    audience?: string;
    voice?: string;
  };

  @Type(() => Number)
  @IsInt()
  @Min(MIN_POSTS_PER_WEEK)
  @Max(MAX_POSTS_PER_WEEK)
  postsPerWeek!: number;

  @Type(() => Number)
  @IsInt()
  @Min(MIN_PLAN_WEEKS)
  @Max(MAX_PLAN_WEEKS)
  weeks!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(CONTENT_PLAN_FORMATS, { each: true })
  formats!: string[];

  @IsOptional()
  @IsIn(CONTENT_PLAN_MIX_MODES)
  formatMix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  startsOn?: string;

  @IsOptional()
  @IsBoolean()
  usePreviousPlan?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referencePlanId?: string;
}
