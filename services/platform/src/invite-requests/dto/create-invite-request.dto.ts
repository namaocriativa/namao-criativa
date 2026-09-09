import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { INSTAGRAM_HANDLE, normalizeInstagram } from '../instagram';

export class CreateInviteRequestDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
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
