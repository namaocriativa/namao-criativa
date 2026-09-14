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

const AVATAR_SRC = '/logo-mark.png';
const TERMS_VERSION = 'v1';
const TERMS_STORAGE_KEY = `namao-legal-accept:${TERMS_VERSION}`;
const LEGACY_TERMS_KEY = 'namao-legal-accept';
const TEASER_DISMISS_KEY = 'namao-chat-teaser-dismissed';

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

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

function storageRemove(key: string) {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    /* ignore quota / private mode */
  }
}

function readGuestTermsAccepted(): boolean {
  if (storageGet(TERMS_STORAGE_KEY) === '1') return true;
  if (storageGet(LEGACY_TERMS_KEY) === '1') {
    writeGuestTermsAccepted(true);
    storageRemove(LEGACY_TERMS_KEY);
    return true;
  }
  return false;
}

function writeGuestTermsAccepted(value: boolean) {
  if (value) storageSet(TERMS_STORAGE_KEY, '1');
  else storageRemove(TERMS_STORAGE_KEY);
}

function readTeaserDismissed(): boolean {
  return storageGet(TEASER_DISMISS_KEY) === '1';
}

function writeTeaserDismissed() {
  storageSet(TEASER_DISMISS_KEY, '1');
}

export function mountNamaoChat(loggedIn = isLoggedIn()) {
  if (document.querySelector('.namao-chat')) return;

  const mode = loggedIn ? 'auth' : 'guest';
  const showTeaser = mode === 'guest' && !readTeaserDismissed();
  const root = document.createElement('div');
  root.className = `namao-chat namao-chat--${mode}`;
  root.innerHTML = `
    <div
      class="namao-chat__panel"
      id="namao-chat-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="namao-chat-title"
      hidden
    >
      <div class="namao-chat__header">
        <img class="namao-chat__header-photo" src="${AVATAR_SRC}" alt="" width="40" height="40" />
        <div class="namao-chat__header-copy">
          <strong id="namao-chat-title">${mode === 'auth' ? 'Assistente Namão' : 'Namão | Criativa'}</strong>
          <span>${mode === 'auth' ? 'Conta conectada' : 'Online agora'}</span>
        </div>
        <button type="button" class="namao-chat__close" aria-label="Fechar">×</button>
      </div>
      <div class="namao-chat__messages" role="log" aria-live="polite"></div>
      <p class="namao-chat__error" hidden>
        <span class="namao-chat__error-text"></span>
        <button type="button" class="namao-chat__retry" hidden>Tentar de novo</button>
      </p>
      <div class="namao-chat__chips"></div>
      <div class="namao-chat__footer">
        <a class="namao-chat__whatsapp" hidden target="_blank" rel="noopener noreferrer">Falar com um humano no WhatsApp</a>
        ${
          mode === 'guest'
            ? `<div class="namao-chat__terms">
          <input type="checkbox" id="namao-chat-terms" name="acceptedTerms" />
          <span>
            <label for="namao-chat-terms">Li e aceito os</label>
            <a href="/termos.html" target="_blank" rel="noopener noreferrer">Termos</a>
            e a
            <a href="/privacidade.html" target="_blank" rel="noopener noreferrer">Privacidade</a>.
          </span>
        </div>
        <p class="namao-chat__terms-ok" hidden>Termos aceitos</p>`
            : ''
        }
        <form class="namao-chat__form">
          <input name="message" maxlength="2000" autocomplete="off" placeholder="Escreva sua mensagem" />
          <button class="namao-chat__send" type="submit" aria-label="Enviar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3.5 12h12M13 6l7 6-7 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
    <div class="namao-chat__dock">
      ${
        showTeaser
          ? `<div class="namao-chat__teaser-wrap">
        <button type="button" class="namao-chat__teaser" aria-controls="namao-chat-panel">
          ${TEASER_HTML}
        </button>
        <button type="button" class="namao-chat__teaser-dismiss" aria-label="Dispensar convite do chat">×</button>
      </div>`
          : ''
      }
      <button type="button" class="namao-chat__launcher" aria-expanded="false" aria-controls="namao-chat-panel" aria-haspopup="dialog" aria-label="Abrir chat">
        <span class="namao-chat__avatar">
          <img class="namao-chat__photo" src="${AVATAR_SRC}" alt="" width="56" height="56" />
          <span class="namao-chat__dot" aria-hidden="true"></span>
        </span>
      </button>
    </div>
  `;
  document.body.appendChild(root);

  root
    .querySelectorAll<HTMLImageElement>('.namao-chat__header-photo, .namao-chat__photo')
    .forEach((img) => {
      img.addEventListener(
        'error',
        () => {
          img.src = '/logo-mark.png';
        },
        { once: true },
      );
    });

  const panel = root.querySelector<HTMLElement>('.namao-chat__panel')!;
  const dock = root.querySelector<HTMLElement>('.namao-chat__dock')!;
  const launcher = root.querySelector<HTMLButtonElement>('.namao-chat__launcher')!;
  const teaserBtn = root.querySelector<HTMLButtonElement>('.namao-chat__teaser');
  const teaserWrap = root.querySelector<HTMLElement>('.namao-chat__teaser-wrap');
  const teaserDismiss = root.querySelector<HTMLButtonElement>(
    '.namao-chat__teaser-dismiss',
  );
  const closeBtn = root.querySelector<HTMLButtonElement>('.namao-chat__close')!;
  const list = root.querySelector<HTMLElement>('.namao-chat__messages')!;
  const errorEl = root.querySelector<HTMLElement>('.namao-chat__error')!;
  const errorText = root.querySelector<HTMLElement>('.namao-chat__error-text')!;
  const retryBtn = root.querySelector<HTMLButtonElement>('.namao-chat__retry')!;
  const chipsEl = root.querySelector<HTMLElement>('.namao-chat__chips')!;
  const form = root.querySelector<HTMLFormElement>('.namao-chat__form')!;
  const input = form.querySelector('input')!;
  const sendBtn = form.querySelector<HTMLButtonElement>('.namao-chat__send')!;
  const whatsapp = root.querySelector<HTMLAnchorElement>('.namao-chat__whatsapp')!;
  const termsInput = root.querySelector<HTMLInputElement>('#namao-chat-terms');
  const termsBlock = root.querySelector<HTMLElement>('.namao-chat__terms');
  const termsOk = root.querySelector<HTMLElement>('.namao-chat__terms-ok');

  let open = false;
  let typing = false;
  let loading = false;
  let session: ChatSessionPayload | null = null;
  let messages: ChatMessage[] = [];
  let started = false;
  let lastFailedContent: string | null = null;

  function guestAcceptedTerms() {
    return mode === 'auth' || Boolean(termsInput?.checked) || readGuestTermsAccepted();
  }

  function focusComposer() {
    if (!open) return;
    if (input.disabled) {
      termsInput?.focus();
      return;
    }
    input.focus();
  }

  function syncGuestTermsUi(opts?: { focus?: boolean }) {
    if (!termsInput) return;
    const accepted = termsInput.checked || readGuestTermsAccepted();
    if (accepted) termsInput.checked = true;
    writeGuestTermsAccepted(accepted);
    if (termsBlock) termsBlock.hidden = accepted;
    if (termsOk) termsOk.hidden = !accepted;
    input.disabled = !accepted;
    sendBtn.disabled = !accepted || typing || loading;
    chipsEl.querySelectorAll<HTMLButtonElement>('.namao-chat__chip').forEach((chip) => {
      chip.disabled = !accepted;
    });
    if (accepted) {
      showError(null);
      if (opts?.focus) focusComposer();
    }
  }

  function setOpen(next: boolean) {
    open = next;
    panel.hidden = !open;
    dock.hidden = open;
    launcher.setAttribute('aria-expanded', String(open));
    teaserBtn?.setAttribute('aria-expanded', String(open));
    if (open) {
      focusComposer();
      scrollToEnd();
    } else {
      launcher.focus();
    }
  }

  function showError(message: string | null, retry = false) {
    errorEl.hidden = !message;
    errorText.textContent = message || '';
    retryBtn.hidden = !retry || !lastFailedContent;
  }

  function scrollToEnd() {
    list.scrollTop = list.scrollHeight;
  }

  function renderLoading() {
    list.innerHTML =
      '<div class="namao-chat__bubble namao-chat__bubble--assistant namao-chat__loading">Conectando…</div>';
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
        '<div class="namao-chat__bubble namao-chat__bubble--assistant namao-chat__typing" aria-label="Digitando"><span></span><span></span><span></span></div>',
      );
    }
    scrollToEnd();
  }

  function renderChips() {
    const chips = mode === 'auth' ? AUTH_CHIPS : GUEST_CHIPS;
    const show = !started && !typing && !loading;
    chipsEl.hidden = !show;
    chipsEl.innerHTML = show
      ? chips
          .map(
            (label) =>
              `<button type="button" class="namao-chat__chip">${escapeHtml(label)}</button>`,
          )
          .join('')
      : '';
    syncGuestTermsUi();
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

  function applySession(payload: ChatSessionPayload) {
    session = payload;
    messages = payload.messages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .map((item) => ({
        id: item.id,
        role: item.role as 'user' | 'assistant',
        content: item.content,
      }));
    started = messages.some((item) => item.role === 'user');
    setWhatsapp(payload.whatsappUrl);
    renderMessages();
    renderChips();
  }

  async function ensureSession(): Promise<ChatSessionPayload> {
    if (session) return session;
    loading = true;
    sendBtn.disabled = true;
    if (!messages.length) renderLoading();
    try {
      const payload = await createChatSession();
      applySession(payload);
      return payload;
    } catch (error) {
      if (!session) list.innerHTML = '';
      throw error;
    } finally {
      loading = false;
      syncGuestTermsUi();
    }
  }

  async function send(text: string, opts?: { retry?: boolean }) {
    const content = text.trim();
    if (typing || loading) return;
    if (!content) {
      showError('Escreva uma mensagem para começar.');
      return;
    }
    if (!guestAcceptedTerms()) {
      showError('Aceite os Termos e a Privacidade para conversar.');
      return;
    }
    showError(null);
    const current = await ensureSession();
    const stored = readStoredSession();
    if (!opts?.retry) {
      messages.push({
        id: `local-${Date.now()}`,
        role: 'user',
        content,
      });
      input.value = '';
    }
    started = true;
    typing = true;
    lastFailedContent = null;
    renderMessages();
    renderChips();
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
      lastFailedContent = null;
    } catch (error) {
      lastFailedContent = content;
      showError(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a mensagem.',
        true,
      );
    } finally {
      typing = false;
      sendBtn.disabled = false;
      renderMessages();
      renderChips();
      focusComposer();
    }
  }

  async function openChat() {
    setOpen(true);
    try {
      const current = await ensureSession();
      const stored = readStoredSession();
      await sendChatEvent(stored?.sessionToken || null, 'chat_opened');
      if (!started) {
        await sendChatEvent(stored?.sessionToken || null, 'chat_started');
      }
      void current;
      focusComposer();
    } catch (error) {
      showError(
        error instanceof Error ? error.message : 'Chat indisponível no momento.',
      );
    }
  }

  function syncKeyboardInset() {
    const vv = window.visualViewport;
    const inset = vv
      ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      : 0;
    root.style.setProperty('--namao-chat-keyboard', `${inset}px`);
  }

  launcher.addEventListener('click', () => {
    void openChat();
  });
  teaserBtn?.addEventListener('click', () => {
    void openChat();
  });
  teaserDismiss?.addEventListener('click', (event) => {
    event.stopPropagation();
    writeTeaserDismissed();
    teaserWrap?.remove();
  });

  closeBtn.addEventListener('click', () => setOpen(false));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void send(input.value);
  });

  chipsEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('.namao-chat__chip');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    void send(button.textContent || '');
  });

  retryBtn.addEventListener('click', () => {
    if (!lastFailedContent) return;
    void send(lastFailedContent, { retry: true });
  });

  whatsapp.addEventListener('click', () => {
    const stored = readStoredSession();
    void sendChatEvent(stored?.sessionToken || null, 'whatsapp_clicked');
  });

  window.visualViewport?.addEventListener('resize', syncKeyboardInset);
  window.visualViewport?.addEventListener('scroll', syncKeyboardInset);
  window.addEventListener('resize', syncKeyboardInset);
  syncKeyboardInset();

  if (termsInput) {
    termsInput.checked = readGuestTermsAccepted();
    termsInput.addEventListener('change', () => {
      if (!termsInput.checked && readGuestTermsAccepted()) {
        termsInput.checked = true;
        return;
      }
      syncGuestTermsUi({ focus: termsInput.checked });
    });
    syncGuestTermsUi();
  }
}
