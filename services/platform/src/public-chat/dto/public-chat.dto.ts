import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePublicChatSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  siteId!: string;
}

export class PublicChatMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}

export const CHAT_EVENT_NAMES = [
  'chat_opened',
  'chat_started',
  'chat_message_sent',
  'lead_captured',
  'whatsapp_clicked',
] as const;

export class PublicChatEventDto {
  @IsString()
  @IsIn(CHAT_EVENT_NAMES)
  name!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, string | number | boolean>;
}
