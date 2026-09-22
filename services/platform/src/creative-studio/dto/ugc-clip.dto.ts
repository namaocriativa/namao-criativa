import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUgcClipDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  characterId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  prompt?: string;

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
  @IsString()
  @MaxLength(64)
  productImageAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceClipId?: string;
}

export class GenerateUgcClipDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  prompt?: string;

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
}
