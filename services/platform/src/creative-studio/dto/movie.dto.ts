import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const MAX_MOVIE_SHOT_CAST = 4;

export class CreateMovieDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  resolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  thinkingLevel?: string;
}

export class UpdateMovieDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  resolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  thinkingLevel?: string;
}

export class CreateMovieShotDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MOVIE_SHOT_CAST)
  @IsString({ each: true })
  @Type(() => String)
  characterIds?: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  characterId?: string;

  @IsOptional()
  @IsObject()
  characterAssets?: Record<string, string>;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  scene!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dialogue?: string;
}

export class UpdateMovieShotDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MOVIE_SHOT_CAST)
  @IsString({ each: true })
  @Type(() => String)
  characterIds?: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  characterId?: string;

  @IsOptional()
  @IsObject()
  characterAssets?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  scene?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dialogue?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  sortOrder?: number;
}

export class GenerateMovieShotDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  duration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  resolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  thinkingLevel?: string;
}
