import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { USER_ROLE } from '../../auth/roles';

export class CreateStudioUserDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsIn([USER_ROLE.ADMIN, USER_ROLE.OPERATOR])
  role!: string;
}
