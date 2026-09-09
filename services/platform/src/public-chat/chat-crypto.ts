import { createHash, randomBytes } from 'crypto';

export const SESSION_TTL_MS = 45 * 60 * 1000;
export const NAMAO_GUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const NAMAO_AUTH_TTL_MS = 180 * 24 * 60 * 60 * 1000;
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_MESSAGES_PER_SESSION = 40;
export const NAMAO_MAX_MESSAGES_PER_SESSION = 200;
export const CHAT_HISTORY_TURNS = 20;
export const CHAT_CHANNEL_LANDING = 'landing';
export const CHAT_CHANNEL_NAMAO = 'namao';

export function newSessionId(): string {
  return `sess_${randomBytes(12).toString('base64url')}`;
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashIp(ip: string): string {
  return sha256(ip.trim() || '0.0.0.0');
}
