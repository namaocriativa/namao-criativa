import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class SelectContentPlanItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  keepIds!: string[];
}
