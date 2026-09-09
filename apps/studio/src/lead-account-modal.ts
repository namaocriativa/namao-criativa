type AccountPayload = {
  email?: string;
  hasPassword?: boolean;
  canEmail?: boolean;
  loginUrl?: string;
  password?: string;
  sent?: boolean;
  message?: string | string[];
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function apiMessage(data: AccountPayload, fallback: string): string {
  if (Array.isArray(data.message)) return data.message.join(" ");
  if (typeof data.message === "string" && data.message) return data.message;
  return fallback;
}

import { profileApi, type EntityKind } from "./profile-api";

export function initLeadAccountModal(host: HTMLElement): {
  open: (leadId: string, kind?: EntityKind) => void;
  close: () => void;
} {
  let leadId: string | null = null;
  let apiKind: EntityKind = "lead";
  let busy = false;

  host.innerHTML = `
    <div class="site-wizard-modal lead-account-modal" hidden>
      <button
        type="button"
        class="site-wizard-modal__backdrop"
        data-account-close
        aria-label="Fechar acesso"
      ></button>
      <div
        class="site-wizard-modal__dialog lead-account-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-account-title"
      >
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Acesso</p>
            <h3 id="lead-account-title">Ver senha</h3>
          </div>
          <button type="button" class="outline" data-account-close>Fechar</button>
        </header>
        <p class="lead-account-hint" data-account-hint>
          A senha atual não pode ser recuperada. Gere uma nova para ver ou enviar.
        </p>
        <dl class="lead-account-fields">
          <div>
            <dt>Login</dt>
            <dd>
              <code data-account-email>—</code>
              <button type="button" class="secondary" data-account-copy="email">
                Copiar
              </button>
            </dd>
          </div>
          <div>
            <dt>Senha</dt>
            <dd>
              <code data-account-password>—</code>
              <button type="button" class="secondary" data-account-copy="password">
                Copiar
              </button>
            </dd>
          </div>
        </dl>
        <p class="lead-account-login" data-account-login hidden></p>
        <div class="actions lead-account-actions">
          <button type="button" data-account-reset>Resetar senha</button>
          <button type="button" class="secondary" data-account-send>
            Enviar e-mail com senha
          </button>
        </div>
        <p class="status" data-account-status></p>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".lead-account-modal")!;
  const emailEl = host.querySelector<HTMLElement>("[data-account-email]")!;
  const passwordEl = host.querySelector<HTMLElement>("[data-account-password]")!;
  const hintEl = host.querySelector<HTMLElement>("[data-account-hint]")!;
  const loginEl = host.querySelector<HTMLElement>("[data-account-login]")!;
  const statusEl = host.querySelector<HTMLElement>("[data-account-status]")!;
  const resetBtn = host.querySelector<HTMLButtonElement>("[data-account-reset]")!;
  const sendBtn = host.querySelector<HTMLButtonElement>("[data-account-send]")!;

  let email = "";
  let password = "";
  let canEmail = false;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function renderCredentials() {
    emailEl.textContent = email || "—";
    passwordEl.textContent = password || "—";
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    setStatus("");
    password = "";
    renderCredentials();
  }

  function setBusy(next: boolean) {
    busy = next;
    resetBtn.disabled = next;
    sendBtn.disabled = next || !canEmail;
  }

  async function loadAccount() {
    if (!leadId) return;
    setBusy(true);
    setStatus("Carregando acesso…");
    try {
      const res = await fetch(profileApi(apiKind, leadId, "/account"));
      const data = (await res.json().catch(() => ({}))) as AccountPayload;
      if (!res.ok) {
        throw new Error(apiMessage(data, "Falha ao carregar acesso"));
      }
      email = data.email || "";
      password = "";
      canEmail = Boolean(data.canEmail);
      hintEl.textContent = canEmail
        ? "A senha atual não pode ser recuperada. Gere uma nova para ver ou enviar."
        : "Este login ainda não tem e-mail real. O envio está desabilitado.";
      if (data.loginUrl) {
        loginEl.hidden = false;
        loginEl.innerHTML = `Página de login: <a href="${escapeHtml(data.loginUrl)}" target="_blank" rel="noreferrer">${escapeHtml(data.loginUrl)}</a>`;
      } else {
        loginEl.hidden = true;
      }
      renderCredentials();
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao carregar acesso"), true);
    } finally {
      setBusy(false);
    }
  }

  async function postAction(path: string, fallback: string) {
    if (!leadId || busy) return;
    setBusy(true);
    setStatus("Processando…");
    try {
      const res = await fetch(
        profileApi(apiKind, leadId, `/account/${path}`),
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as AccountPayload;
      if (!res.ok) {
        throw new Error(apiMessage(data, fallback));
      }
      email = data.email || email;
      password = data.password || "";
      renderCredentials();
      setStatus(
        data.sent
          ? "E-mail enviado. A senha nova está visível abaixo."
          : "Senha resetada. Copie agora — ela não será mostrada de novo.",
      );
    } catch (error) {
      setStatus(errorMessage(error, fallback), true);
    } finally {
      setBusy(false);
    }
  }

  async function copy(kind: "email" | "password") {
    const value = kind === "email" ? email : password;
    if (!value) {
      setStatus(
        kind === "password"
          ? "Gere uma senha antes de copiar."
          : "Login ainda não carregou.",
        true,
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setStatus(kind === "email" ? "Login copiado." : "Senha copiada.");
    } catch {
      setStatus("Não foi possível copiar.", true);
    }
  }

  function open(nextId: string, kind: EntityKind = "lead") {
    leadId = nextId;
    apiKind = kind;
    email = "";
    password = "";
    renderCredentials();
    setStatus("");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    void loadAccount();
  }

  host.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-account-close]")) {
      close();
      return;
    }
    const copyKind = target?.closest<HTMLElement>("[data-account-copy]")?.dataset
      .accountCopy;
    if (copyKind === "email" || copyKind === "password") {
      void copy(copyKind);
    }
  });

  resetBtn.addEventListener("click", () => {
    void postAction("reset-password", "Falha ao resetar senha");
  });
  sendBtn.addEventListener("click", () => {
    void postAction("send-password", "Falha ao enviar e-mail");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });

  return { open, close };
}
