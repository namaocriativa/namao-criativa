import { randomBytes } from 'crypto';

export const FALLBACK_EMAIL_DOMAIN = 'clientes.namao.local';

export function normalizeEmail(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim().toLowerCase() ?? '';
  return trimmed || null;
}

export function fallbackEmail(leadId: string): string {
  const slug = leadId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase();
  return `lead+${slug || 'acct'}@${FALLBACK_EMAIL_DOMAIN}`;
}

export function isSendableEmail(email: string): boolean {
  const value = email.trim().toLowerCase();
  if (value.endsWith(`@${FALLBACK_EMAIL_DOMAIN}`)) return false;
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
}

export function generatePassword(): string {
  return randomBytes(12).toString('base64url').slice(0, 16);
}

export function publicLoginUrl(base?: string | null): string {
  const origin = (base || 'http://localhost:5174').replace(/\/$/, '');
  return `${origin}/login.html`;
}

export function publicProposalLoginUrl(base?: string | null): string {
  return `${publicLoginUrl(base)}?next=${encodeURIComponent('/proposta.html')}`;
}

export function publicLogoUrl(base?: string | null): string {
  const origin = (base || 'http://localhost:5174').replace(/\/$/, '');
  return `${origin}/logo.png`;
}
