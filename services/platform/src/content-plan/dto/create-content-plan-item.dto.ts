import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContentPlanItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  planModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  imageModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  imageSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  videoModel?: string;

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
  @MaxLength(64)
  characterId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  characterAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  videoHookId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  takeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slides?: number;
}
