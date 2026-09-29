import { IsString, MaxLength, MinLength } from 'class-validator';

export class SelectContentPlanMediaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  selectedStudioAssetId!: string;
}
