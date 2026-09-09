import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateNamaoChatSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  guestSessionToken?: string;
}

export class NamaoChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}

export const NAMAO_CHAT_EVENT_NAMES = [
  'chat_opened',
  'chat_started',
  'chat_message_sent',
  'lead_captured',
  'whatsapp_clicked',
] as const;

export class NamaoChatEventDto {
  @IsString()
  @IsIn(NAMAO_CHAT_EVENT_NAMES)
  name!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, string | number | boolean>;
}
