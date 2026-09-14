import { probeLoggedIn } from '../session';

export const CHAT_SESSION_KEY = 'namao_chat_session';

export type ChatMode = 'guest' | 'auth';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type StoredChatSession = {
  sessionId: string;
  sessionToken: string;
};

export type ChatSessionPayload = {
  sessionId: string;
  sessionToken?: string;
  expiresAt: string;
  mode: ChatMode;
  registered: boolean;
  whatsappUrl: string | null;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt?: string;
  }>;
};

let loggedIn = false;

export function isLoggedIn(): boolean {
  return loggedIn;
}

export async function hydrateAuth(): Promise<boolean> {
  loggedIn = await probeLoggedIn();
  return loggedIn;
}

export function readStoredSession(): StoredChatSession | null {
  try {
    const raw =
      sessionStorage.getItem(CHAT_SESSION_KEY) ||
      localStorage.getItem(CHAT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredChatSession>;
    if (!parsed.sessionId || !parsed.sessionToken) return null;
    return {
      sessionId: String(parsed.sessionId),
      sessionToken: String(parsed.sessionToken),
    };
  } catch {
    return null;
  }
}

export function writeStoredSession(session: StoredChatSession) {
  const payload = JSON.stringify(session);
  sessionStorage.setItem(CHAT_SESSION_KEY, payload);
  if (loggedIn) {
    localStorage.setItem(CHAT_SESSION_KEY, payload);
  } else {
    localStorage.removeItem(CHAT_SESSION_KEY);
  }
}

export function clearChatSession() {
  sessionStorage.removeItem(CHAT_SESSION_KEY);
  localStorage.removeItem(CHAT_SESSION_KEY);
}

function headers(sessionToken?: string | null): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
  return headers;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    const raw = body.message;
    return Array.isArray(raw) ? String(raw[0]) : String(raw || `HTTP ${res.status}`);
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function createChatSession(): Promise<ChatSessionPayload> {
  const stored = readStoredSession();
  if (!loggedIn) {
    clearChatSession();
  }
  const res = await fetch('/namao-chat/session', {
    method: 'POST',
    credentials: 'include',
    headers: headers(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await readError(res));
  const payload = (await res.json()) as ChatSessionPayload;
  loggedIn = payload.mode === 'auth';
  if (payload.sessionToken) {
    writeStoredSession({
      sessionId: payload.sessionId,
      sessionToken: payload.sessionToken,
    });
  } else if (payload.mode === 'auth') {
    writeStoredSession({
      sessionId: payload.sessionId,
      sessionToken: '',
    });
  } else if (stored && stored.sessionId === payload.sessionId) {
    writeStoredSession(stored);
  }
  return payload;
}

export async function loadHistory(
  sessionToken: string | null,
): Promise<ChatSessionPayload> {
  const res = await fetch('/namao-chat/history', {
    credentials: 'include',
    headers: headers(sessionToken),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as ChatSessionPayload;
}

export async function sendChatEvent(
  sessionToken: string | null,
  name: string,
  payload?: Record<string, string | number | boolean>,
) {
  await fetch('/namao-chat/events', {
    method: 'POST',
    credentials: 'include',
    headers: headers(sessionToken),
    body: JSON.stringify({ name, ...(payload ? { payload } : {}) }),
  }).catch(() => undefined);
}

export async function streamChat(opts: {
  sessionId: string;
  sessionToken: string | null;
  message: string;
  onDelta: (delta: string) => void;
}): Promise<{ messageId?: string; registered?: boolean }> {
  const res = await fetch('/namao-chat', {
    method: 'POST',
    credentials: 'include',
    headers: headers(opts.sessionToken),
    body: JSON.stringify({
      sessionId: opts.sessionId,
      message: opts.message,
    }),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  if (!res.body) throw new Error('Resposta vazia');
  const { parseSseStream } = await import('./sse');
  let messageId: string | undefined;
  let registered: boolean | undefined;
  for await (const event of parseSseStream(res.body)) {
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(event.data) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (event.event === 'token' && typeof data.delta === 'string') {
      opts.onDelta(data.delta);
    } else if (event.event === 'error') {
      throw new Error('O assistente está indisponível no momento.');
    } else if (event.event === 'done') {
      messageId = typeof data.messageId === 'string' ? data.messageId : undefined;
      registered = Boolean(data.registered);
    }
  }
  return { messageId, registered };
}
