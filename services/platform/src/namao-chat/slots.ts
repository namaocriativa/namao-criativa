import {
  INSTAGRAM_HANDLE,
  normalizeInstagram,
} from '../auth/instagram';

export type LeadSlots = {
  name?: string;
  email?: string;
  instagram?: string;
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const NOT_A_NAME =
  /^(quero|tenho|como|qual|quais|voc[eê]s|voc[eê]|ol[aá]|oi|sim|n[aã]o|falar|criar|conta|whatsapp|servi[cç]o|pre[cç]o|ajuda|humane?|dúvida|duvida)\b/i;

export function parseSlots(raw: unknown): LeadSlots {
  if (!raw || typeof raw !== 'object') return {};
  const value = raw as Record<string, unknown>;
  const name = String(value.name || '').trim();
  const email = String(value.email || '').trim().toLowerCase();
  const instagram = String(value.instagram || '').trim();
  return {
    ...(name ? { name: name.slice(0, 120) } : {}),
    ...(EMAIL_RE.test(email) ? { email } : {}),
    ...(instagram ? { instagram } : {}),
  };
}

export function missingSlot(
  slots: LeadSlots,
): 'name' | 'email' | 'instagram' | null {
  if (!slots.name) return 'name';
  if (!slots.email) return 'email';
  if (!slots.instagram) return 'instagram';
  return null;
}

export function slotsComplete(
  slots: LeadSlots,
): slots is Required<LeadSlots> {
  return Boolean(slots.name && slots.email && slots.instagram);
}

export function mergeSlots(current: LeadSlots, message: string): LeadSlots {
  const next: LeadSlots = { ...current };
  const text = String(message || '').trim();
  if (!text) return next;

  const emailMatch = text.match(EMAIL_RE);
  if (emailMatch && !next.email) {
    next.email = emailMatch[0].toLowerCase();
  }

  const awaitingInstagram = missingSlot(next) === 'instagram';
  const instagram = extractInstagram(text, awaitingInstagram);
  if (instagram && !next.instagram) {
    next.instagram = instagram;
  }

  if (!next.name) {
    const name = extractName(text, Boolean(emailMatch || instagram));
    if (name) next.name = name;
  }
  return next;
}

function extractInstagram(
  message: string,
  awaitingInstagram: boolean,
): string | null {
  const tokens = message.split(/\s+/);
  for (const token of tokens) {
    const raw = token.replace(/[.,;:!?)]+$/g, '');
    const explicit =
      raw.startsWith('@') || /instagram\.com|instagr\.am/i.test(raw);
    if (!explicit && !(awaitingInstagram && tokens.length === 1)) {
      continue;
    }
    const handle = normalizeInstagram(raw);
    if (INSTAGRAM_HANDLE.test(handle) && handle.length >= 2) {
      return handle;
    }
  }
  return null;
}

function extractName(message: string, hadContactToken: boolean): string | null {
  let cleaned = message
    .replace(EMAIL_RE, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/@[\w.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  cleaned = cleaned.replace(
    /^(meu nome [eé]|eu sou|sou a|sou o|me chamo|pode me chamar de)\s+/i,
    '',
  );
  if (!cleaned || cleaned.includes('?') || NOT_A_NAME.test(cleaned)) {
    return null;
  }
  if (hadContactToken && cleaned.length < 2) return null;
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length < 1 || words.length > 5) return null;
  if (cleaned.length < 2 || cleaned.length > 80) return null;
  if (!/^[\p{L}][\p{L}\s'.-]*$/u.test(cleaned)) return null;
  return cleaned;
}
