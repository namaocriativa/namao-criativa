import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVideoProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
