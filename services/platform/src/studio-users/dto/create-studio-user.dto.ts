import { IsEmail } from 'class-validator';

export class CreateStudioUserDto {
  @IsEmail()
  email!: string;
}
