import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MAX_CAROUSEL_SLIDES,
  MIN_CAROUSEL_SLIDES,
} from '../../creative-studio/carousel-instagram.planner';

export class CalendarPostFromCarouselDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  sourceUrl!: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  leadId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_CAROUSEL_SLIDES)
  @Max(MAX_CAROUSEL_SLIDES)
  slideCount?: number;
}
