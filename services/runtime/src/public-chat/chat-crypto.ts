import { createHash, randomBytes } from 'crypto';

export const SESSION_TTL_MS = 45 * 60 * 1000;
export const MAX_MESSAGE_CHARS = 2000;
export const MAX_MESSAGES_PER_SESSION = 40;

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
