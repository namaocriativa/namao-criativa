import { Type } from 'class-transformer';
import {
  IsInt,
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
} from '../carousel-instagram.planner';

export type CarouselBrandReferenceFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export class GenerateCarouselDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_CAROUSEL_SLIDES)
  @Max(MAX_CAROUSEL_SLIDES)
  slideCount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  planModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  imageSize?: string;

  /** Internal: brand logo files attached before slides (not from HTTP body). */
  brandReferences?: CarouselBrandReferenceFile[];
}
