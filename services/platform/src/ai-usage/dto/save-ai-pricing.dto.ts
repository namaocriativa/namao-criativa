import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class AiPriceRowDto {
  @IsString()
  model!: string;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  usdPerMillion?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  usdPerUnit?: number;
}

export class SaveAiPricingDto {
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  usdToBrl?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => AiPriceRowDto)
  rows?: AiPriceRowDto[];
}
