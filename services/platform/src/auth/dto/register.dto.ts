import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { INSTAGRAM_HANDLE, normalizeInstagram } from '../instagram';

export class RegisterDto {
  @IsOptional()
  @IsString()
  inviteToken?: string;

  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) =>
    String(value ?? '')
      .trim()
      .toLowerCase(),
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Transform(({ value }) => normalizeInstagram(String(value ?? '')))
  @IsString()
  @Matches(INSTAGRAM_HANDLE, { message: 'Instagram inválido' })
  instagram!: string;
}
