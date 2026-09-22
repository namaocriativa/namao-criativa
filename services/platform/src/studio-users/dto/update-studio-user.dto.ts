import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { USER_ROLE } from '../../auth/roles';

export class UpdateStudioUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn([USER_ROLE.ADMIN, USER_ROLE.OPERATOR])
  role?: string;

  @IsOptional()
  @IsBoolean()
  canAccessImages?: boolean;

  @IsOptional()
  @IsBoolean()
  canAccessVideos?: boolean;
}
