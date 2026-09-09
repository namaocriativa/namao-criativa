import './chat.css';
import {
  type ChatMessage,
  type ChatSessionPayload,
  createChatSession,
  isLoggedIn,
  readStoredSession,
  sendChatEvent,
  streamChat,
} from './api';

const GUEST_CHIPS = [
  'Quais serviços vocês oferecem?',
  'Quero criar conta',
  'Falar com um humano',
];

const AUTH_CHIPS = [
  'Como está o meu site?',
  'Como conectar o Instagram?',
  'Falar com um humano',
];

const TEASER_HTML =
  'Olá, quer saber como a Namão pode <strong>crescer o seu negócio</strong>?';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMarkdown(value: string): string {
  return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

const AVATAR_SRC = '/logo-icon-with-effects.png';

export function mountNamaoChat() {
  if (document.querySelector('.namao-chat')) return;

  const mode = isLoggedIn() ? 'auth' : 'guest';
  const root = document.createElement('div');
  root.className = `namao-chat namao-chat--${mode}`;
  root.innerHTML = `
    <div class="namao-chat__panel" hidden>
      <div class="namao-chat__header">
        <img class="namao-chat__header-photo" src="${AVATAR_SRC}" alt="" width="40" height="40" />
        <div class="namao-chat__header-copy">
          <strong>${mode === 'auth' ? 'Assistente Namão' : 'Namão | Criativa'}</strong>
          <span>${mode === 'auth' ? 'Conta conectada' : 'Online agora'}</span>
        </div>
        <button type="button" class="namao-chat__close" aria-label="Fechar">×</button>
      </div>
      <div class="namao-chat__messages" role="log" aria-live="polite"></div>
      <p class="namao-chat__error" hidden></p>
      <div class="namao-chat__chips"></div>
      <div class="namao-chat__footer">
        <a class="namao-chat__whatsapp" hidden target="_blank" rel="noopener noreferrer">Falar com um humano no WhatsApp</a>
        <form class="namao-chat__form">
          <input name="message" maxlength="2000" autocomplete="off" placeholder="Sua resposta..." />
          <button class="namao-chat__send" type="submit" aria-label="Enviar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3.5 12h12M13 6l7 6-7 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
    <button type="button" class="namao-chat__launcher" aria-expanded="false" aria-label="Abrir chat">
      ${
        mode === 'guest'
          ? `<span class="namao-chat__teaser">${TEASER_HTML}</span>`
          : ''
      }
      <span class="namao-chat__avatar">
        <img class="namao-chat__photo" src="${AVATAR_SRC}" alt="" width="56" height="56" />
        <span class="namao-chat__dot" aria-hidden="true"></span>
      </span>
    </button>
  `;
  document.body.appendChild(root);

  root
    .querySelectorAll<HTMLImageElement>('.namao-chat__header-photo, .namao-chat__photo')
    .forEach((img) => {
      img.addEventListener(
        'error',
        () => {
          img.src = '/logo-icon.png';
        },
        { once: true },
      );
    });

  const panel = root.querySelector<HTMLElement>('.namao-chat__panel')!;
  const launcher = root.querySelector<HTMLButtonElement>('.namao-chat__launcher')!;
  const closeBtn = root.querySelector<HTMLButtonElement>('.namao-chat__close')!;
  const list = root.querySelector<HTMLElement>('.namao-chat__messages')!;
  const errorEl = root.querySelector<HTMLElement>('.namao-chat__error')!;
  const chipsEl = root.querySelector<HTMLElement>('.namao-chat__chips')!;
  const form = root.querySelector<HTMLFormElement>('.namao-chat__form')!;
  const input = form.querySelector('input')!;
  const sendBtn = form.querySelector<HTMLButtonElement>('.namao-chat__send')!;
  const whatsapp = root.querySelector<HTMLAnchorElement>('.namao-chat__whatsapp')!;

  let open = false;
  let typing = false;
  let session: ChatSessionPayload | null = null;
  let messages: ChatMessage[] = [];
  let started = false;

  function setOpen(next: boolean) {
    open = next;
    panel.hidden = !open;
    launcher.hidden = open;
    launcher.setAttribute('aria-expanded', String(open));
    if (open) {
      input.focus();
      scrollToEnd();
    }
  }

  function showError(message: string | null) {
    errorEl.hidden = !message;
    errorEl.textContent = message || '';
  }

  function scrollToEnd() {
    list.scrollTop = list.scrollHeight;
  }

  function renderMessages() {
    list.innerHTML = messages
      .map(
        (item) =>
          `<div class="namao-chat__bubble namao-chat__bubble--${item.role}">${renderMarkdown(item.content)}</div>`,
      )
      .join('');
    if (typing) {
      list.insertAdjacentHTML(
        'beforeend',
        '<div class="namao-chat__bubble namao-chat__bubble--assistant namao-chat__typing">…</div>',
      );
    }
    scrollToEnd();
  }

  function renderChips() {
    const chips = mode === 'auth' ? AUTH_CHIPS : GUEST_CHIPS;
    const show = !started && !typing;
    chipsEl.hidden = !show;
    chipsEl.innerHTML = show
      ? chips
          .map(
            (label) =>
              `<button type="button" class="namao-chat__chip">${escapeHtml(label)}</button>`,
          )
          .join('')
      : '';
  }

  function setWhatsapp(url: string | null) {
    if (!url) {
      whatsapp.hidden = true;
      whatsapp.removeAttribute('href');
      return;
    }
    whatsapp.hidden = false;
    whatsapp.href = url;
  }

  async function ensureSession(): Promise<ChatSessionPayload> {
    if (session) return session;
    session = await createChatSession();
    messages = session.messages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({
        id: item.id,
        role: item.role as 'user' | 'assistant',
        content: item.content,
      }));
    started = messages.some((item) => item.role === 'user');
    setWhatsapp(session.whatsappUrl);
    renderMessages();
    renderChips();
    return session;
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || typing) return;
    showError(null);
    const current = await ensureSession();
    const stored = readStoredSession();
    messages.push({
      id: `local-${Date.now()}`,
      role: 'user',
      content,
    });
    started = true;
    typing = true;
    renderMessages();
    renderChips();
    input.value = '';
    sendBtn.disabled = true;

    const assistantId = `asst-${Date.now()}`;
    let assembled = '';
    try {
      const result = await streamChat({
        sessionId: current.sessionId,
        sessionToken: stored?.sessionToken || null,
        message: content,
        onDelta(delta) {
          assembled += delta;
          const existing = messages.find((item) => item.id === assistantId);
          if (existing) existing.content = assembled;
          else {
            messages.push({
              id: assistantId,
              role: 'assistant',
              content: assembled,
            });
          }
          typing = true;
          renderMessages();
        },
      });
      if (!assembled) {
        messages.push({
          id: result.messageId || assistantId,
          role: 'assistant',
          content: 'Não consegui responder agora. Tente de novo.',
        });
      }
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a mensagem.',
      );
    } finally {
      typing = false;
      sendBtn.disabled = false;
      renderMessages();
      renderChips();
      input.focus();
    }
  }

  launcher.addEventListener('click', async () => {
    setOpen(true);
    try {
      const current = await ensureSession();
      const stored = readStoredSession();
      await sendChatEvent(stored?.sessionToken || null, 'chat_opened');
      if (!started) {
        await sendChatEvent(stored?.sessionToken || null, 'chat_started');
      }
      void current;
    } catch (error) {
      showError(
        error instanceof Error ? error.message : 'Chat indisponível no momento.',
      );
    }
  });

  closeBtn.addEventListener('click', () => setOpen(false));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void send(input.value);
  });

  chipsEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('.namao-chat__chip');
    if (!(button instanceof HTMLButtonElement)) return;
    void send(button.textContent || '');
  });

  whatsapp.addEventListener('click', () => {
    const stored = readStoredSession();
    void sendChatEvent(stored?.sessionToken || null, 'whatsapp_clicked');
  });
}
