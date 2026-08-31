import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class LlmRoleConfigDto {
  @IsIn(['ollama', 'gemini'])
  provider!: 'ollama' | 'gemini';

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  model!: string;
}

export class LlmRolesDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => LlmRoleConfigDto)
  plan!: LlmRoleConfigDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => LlmRoleConfigDto)
  code!: LlmRoleConfigDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => LlmRoleConfigDto)
  vision!: LlmRoleConfigDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => LlmRoleConfigDto)
  chat!: LlmRoleConfigDto;
}

export class UpdateLlmSettingsDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => LlmRolesDto)
  roles!: LlmRolesDto;
}
