import { useEffect, useMemo, useRef, useState } from 'react';
import { parseSseStream } from './sse';
import './ai-chat.css';

export type AiChatProps = {
  suggestions?: unknown;
  position?: unknown;
  cta?: unknown;
  showWhatsappCta?: unknown;
  variant?: unknown;
  greeting?: unknown;
  actions?: unknown;
};

const DEFAULT_CONCIERGE_GREETING =
  'Olá! Posso ajudar você a encontrar a solução ideal.';
const DEFAULT_CONCIERGE_ACTIONS = [
  'Quero contratar',
  'Tenho uma dúvida',
  'Quero saber preços',
];

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type BootConfig = {
  siteId: string;
  apiBase: string;
};

function readBoot(): BootConfig | null {
  if (typeof window === 'undefined') return null;
  const raw = (window as Window & { LEAD_DISCOVERY?: Partial<BootConfig> })
    .LEAD_DISCOVERY;
  const siteId = String(raw?.siteId || '').trim();
  if (!siteId) return null;
  return {
    siteId,
    apiBase: String(raw?.apiBase || '').replace(/\/$/, ''),
  };
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3);
}

function whatsappHref(props: AiChatProps): string | null {
  if (props.showWhatsappCta === false) return null;
  const cta = props.cta;
  if (!cta || typeof cta !== 'object') return null;
  const href = String((cta as { whatsapp?: unknown }).whatsapp || '').trim();
  return href || null;
}

function positionClass(value: unknown): string {
  return value === 'bottom-left' ? 'lk-ai-chat--bl' : 'lk-ai-chat--br';
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown; code?: unknown };
    return String(body.message || body.code || `HTTP ${res.status}`);
  } catch {
    return `HTTP ${res.status}`;
  }
}

export function AiChatWidget({ props = {} }: { props?: AiChatProps }) {
  const boot = useMemo(() => readBoot(), []);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<{ sessionId: string; sessionToken: string } | null>(
    null,
  );
  const listRef = useRef<HTMLDivElement | null>(null);
  const suggestions = asStringList(props.suggestions);
  const concierge = props.variant === 'concierge';
  const greeting =
    String(props.greeting || '').trim() || DEFAULT_CONCIERGE_GREETING;
  const actions = asStringList(props.actions);
  const conciergeActions = actions.length
    ? actions
    : DEFAULT_CONCIERGE_ACTIONS;
  const whatsapp = whatsappHref(props);
  const started = messages.length > 0;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, typing, open]);

  if (!boot) return null;

  async function ensureSession(): Promise<{
    sessionId: string;
    sessionToken: string;
  }> {
    if (sessionRef.current) return sessionRef.current;
    const res = await fetch(`${boot!.apiBase}/public/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: boot!.siteId }),
    });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }
    const body = (await res.json()) as {
      sessionId?: string;
      sessionToken?: string;
    };
    if (!body.sessionId || !body.sessionToken) {
      throw new Error('Sessão inválida');
    }
    const session = {
      sessionId: body.sessionId,
      sessionToken: body.sessionToken,
    };
    sessionRef.current = session;
    void fetch(`${boot!.apiBase}/public/chat/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.sessionToken}`,
      },
      body: JSON.stringify({ name: 'chat_started' }),
    }).catch(() => undefined);
    return session;
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || typing) return;
    setInput('');
    setError(null);
    const userId = `u-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userId, role: 'user', content: message }]);
    setTyping(true);
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    try {
      const session = await ensureSession();
      const res = await fetch(`${boot!.apiBase}/public/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({ sessionId: session.sessionId, message }),
      });
      if (!res.ok || !res.body) {
        throw new Error(await readErrorMessage(res));
      }
      let assembled = '';
      for await (const evt of parseSseStream(res.body)) {
        if (evt.event === 'token') {
          try {
            const payload = JSON.parse(evt.data) as { delta?: string };
            assembled += String(payload.delta || '');
            const snapshot = assembled;
            setMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId ? { ...item, content: snapshot } : item,
              ),
            );
          } catch {
            // ignore malformed token
          }
        } else if (evt.event === 'error') {
          let code = 'error';
          try {
            code = String((JSON.parse(evt.data) as { code?: string }).code || code);
          } catch {
            // keep default
          }
          throw new Error(code);
        }
      }
      if (!assembled.trim()) {
        throw new Error('empty');
      }
    } catch (err) {
      const label = err instanceof Error ? err.message : 'Falha no chat';
      setError(label);
      setMessages((prev) => prev.filter((item) => item.id !== assistantId));
      sessionRef.current = null;
    } finally {
      setTyping(false);
    }
  }

  return (
    <div className={`lk-ai-chat ${positionClass(props.position)}`}>
      {open ? (
        <div className="lk-ai-chat__panel" role="dialog" aria-label={concierge ? 'Concierge' : 'Chat'}>
          <div className="lk-ai-chat__header">
            <strong>{concierge ? 'Concierge' : 'Assistente'}</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar">
              ×
            </button>
          </div>
          <div className="lk-ai-chat__messages" ref={listRef}>
            {concierge && !started ? (
              <div className="lk-ai-chat__bubble lk-ai-chat__bubble--assistant">
                {greeting}
              </div>
            ) : null}
            {messages.map((item) => (
              <div
                key={item.id}
                className={`lk-ai-chat__bubble lk-ai-chat__bubble--${item.role}`}
              >
                {item.content}
              </div>
            ))}
            {typing ? (
              <div className="lk-ai-chat__bubble lk-ai-chat__bubble--assistant">
                …
              </div>
            ) : null}
            {error ? (
              <div className="lk-ai-chat__error">
                <span>{error}</span>{' '}
                <button
                  type="button"
                  className="lk-ai-chat__retry"
                  onClick={() => setError(null)}
                >
                  Tentar de novo
                </button>
              </div>
            ) : null}
          </div>
          {concierge && !started ? (
            <div className="lk-ai-chat__actions">
              {conciergeActions.map((item) => (
                <button key={item} type="button" onClick={() => void send(item)}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          {!concierge && suggestions.length ? (
            <div className="lk-ai-chat__suggestions">
              {suggestions.map((item) => (
                <button key={item} type="button" onClick={() => void send(item)}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          {whatsapp ? (
            <a
              className="lk-ai-chat__wa"
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
            >
              Falar no WhatsApp
            </a>
          ) : null}
          {!concierge || started ? (
            <form
              className="lk-ai-chat__form"
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escreva sua mensagem"
                maxLength={2000}
                aria-label="Mensagem"
              />
              <button className="lk-ai-chat__send" type="submit" disabled={typing}>
                Enviar
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="lk-ai-chat__fab"
        aria-label={concierge ? 'Abrir concierge' : 'Abrir chat'}
        onClick={() => {
          setOpen((current) => !current);
          const name = open ? undefined : 'chat_opened';
          if (name) {
            const session = sessionRef.current;
            if (session) {
              void fetch(`${boot.apiBase}/public/chat/events`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.sessionToken}`,
                },
                body: JSON.stringify({ name }),
              }).catch(() => undefined);
            }
          }
        }}
      >
        {concierge ? 'Ajuda' : 'Chat'}
      </button>
    </div>
  );
}
