import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateVideoDto {
  @IsString()
  @MaxLength(8000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
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

  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstFrameImageAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastFrameImageAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstFrameAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastFrameAssetId?: string;
}
