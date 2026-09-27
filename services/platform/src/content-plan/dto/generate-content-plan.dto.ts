import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
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

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

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
}
