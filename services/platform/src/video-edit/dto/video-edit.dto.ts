import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateVideoEditDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
}

export class UpdateVideoEditDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsObject()
  document?: Record<string, unknown>;
}
