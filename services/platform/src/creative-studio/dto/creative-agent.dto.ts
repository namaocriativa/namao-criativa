import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ExecuteCreativeToolDto {
  @IsIn(['image', 'video'])
  kind!: 'image' | 'video';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  conversationId?: string;

  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}

export class CreateCreativeConversationDto {
  @IsIn(['image', 'video'])
  kind!: 'image' | 'video';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class CreateCreativeTurnDto {
  @IsOptional()
  @IsIn(['image', 'video'])
  kind?: 'image' | 'video';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  conversationId?: string;

  @IsString()
  @MaxLength(8000)
  text!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  referenceAssetIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstFrameImageAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastFrameImageAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstFrameAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastFrameAssetId?: string;
}
