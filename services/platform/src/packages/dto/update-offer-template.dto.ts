import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOfferTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  emailSubject?: string;

  @IsOptional()
  @IsString()
  emailBody?: string;

  @IsOptional()
  @IsString()
  whatsappMessage?: string;
}
