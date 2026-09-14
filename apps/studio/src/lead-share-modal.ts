import { api } from "./api";
import { profileApi, type EntityKind } from "./profile-api";

type ShareUser = {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
};

type SharesPayload = {
  canManage?: boolean;
  createdBy?: ShareUser | null;
  shares?: ShareUser[];
  candidates?: Array<{ id: string; name: string; email: string }>;
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

function apiMessage(data: SharesPayload, fallback: string): string {
  if (Array.isArray(data.message)) return data.message.join(" ");
  if (typeof data.message === "string" && data.message) return data.message;
  return fallback;
}

function userLabel(user: { name?: string; email?: string }): string {
  return user.name || user.email || "Usuário";
}

export function initLeadShareModal(host: HTMLElement): {
  open: (leadId: string, kind?: EntityKind) => void;
  close: () => void;
} {
  let leadId: string | null = null;
  let apiKind: EntityKind = "lead";
  let busy = false;
  let canManage = false;
  let candidates: Array<{ id: string; name: string; email: string }> = [];

  host.innerHTML = `
    <div class="site-wizard-modal lead-share-modal" hidden>
      <button
        type="button"
        class="site-wizard-modal__backdrop"
        data-share-close
        aria-label="Fechar compartilhamento"
      ></button>
      <div
        class="site-wizard-modal__dialog lead-share-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-share-title"
      >
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Acesso</p>
            <h3 id="lead-share-title">Compartilhar</h3>
          </div>
          <button type="button" class="outline" data-share-close>Fechar</button>
        </header>
        <p class="lead-share-hint" data-share-hint>
          Quem receber o acesso vê e opera este perfil. Só o criador ou um admin
          pode gerenciar o compartilhamento.
        </p>
        <ul class="lead-share-list" data-share-list></ul>
        <form class="lead-share-form" data-share-form>
          <label>
            <span>Compartilhar com</span>
            <select data-share-select>
              <option value="">Selecione um usuário</option>
            </select>
          </label>
          <button type="submit" data-share-add>Adicionar</button>
        </form>
        <p class="status" data-share-status></p>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".lead-share-modal")!;
  const listEl = host.querySelector<HTMLElement>("[data-share-list]")!;
  const form = host.querySelector<HTMLFormElement>("[data-share-form]")!;
  const select = host.querySelector<HTMLSelectElement>("[data-share-select]")!;
  const addBtn = host.querySelector<HTMLButtonElement>("[data-share-add]")!;
  const statusEl = host.querySelector<HTMLElement>("[data-share-status]")!;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    setStatus("");
  }

  function setBusy(next: boolean) {
    busy = next;
    addBtn.disabled = next || !canManage || !select.value;
    select.disabled = next || !canManage;
  }

  function renderCandidates() {
    select.innerHTML = `<option value="">Selecione um usuário</option>`;
    for (const user of candidates) {
      const opt = document.createElement("option");
      opt.value = user.id;
      opt.textContent = `${userLabel(user)} (${user.email})`;
      select.appendChild(opt);
    }
    form.hidden = !canManage;
    addBtn.disabled = busy || !canManage || !select.value;
    select.disabled = busy || !canManage;
  }

  function renderShares(shares: ShareUser[]) {
    if (!shares.length) {
      listEl.innerHTML = `<li class="lead-share-empty">Ninguém além do criador tem acesso.</li>`;
      return;
    }
    listEl.innerHTML = shares
      .map(
        (user) => `
        <li>
          <div>
            <strong>${escapeHtml(userLabel(user))}</strong>
            <p class="meta">${escapeHtml(user.email)}</p>
          </div>
          ${
            canManage
              ? `<button type="button" class="danger" data-share-remove="${escapeHtml(user.id)}">Remover</button>`
              : ""
          }
        </li>`,
      )
      .join("");
  }

  async function loadShares() {
    if (!leadId) return;
    setBusy(true);
    setStatus("Carregando…");
    try {
      const res = await api(profileApi(apiKind, leadId, "/shares"));
      const data = (await res.json().catch(() => ({}))) as SharesPayload;
      if (!res.ok) {
        throw new Error(apiMessage(data, "Falha ao carregar compartilhamento"));
      }
      canManage = Boolean(data.canManage);
      candidates = data.candidates ?? [];
      renderShares(data.shares ?? []);
      renderCandidates();
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao carregar compartilhamento"), true);
    } finally {
      setBusy(false);
    }
  }

  async function addShare(userId: string) {
    if (!leadId || busy || !userId) return;
    setBusy(true);
    setStatus("Compartilhando…");
    try {
      const res = await api(profileApi(apiKind, leadId, "/shares"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => ({}))) as SharesPayload;
      if (!res.ok) {
        throw new Error(apiMessage(data, "Falha ao compartilhar"));
      }
      canManage = Boolean(data.canManage);
      candidates = data.candidates ?? [];
      renderShares(data.shares ?? []);
      renderCandidates();
      setStatus("Acesso compartilhado.");
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao compartilhar"), true);
    } finally {
      setBusy(false);
    }
  }

  async function removeShare(userId: string) {
    if (!leadId || busy || !userId) return;
    setBusy(true);
    setStatus("Removendo…");
    try {
      const res = await api(
        profileApi(apiKind, leadId, `/shares/${encodeURIComponent(userId)}`),
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as SharesPayload;
      if (!res.ok) {
        throw new Error(apiMessage(data, "Falha ao remover acesso"));
      }
      canManage = Boolean(data.canManage);
      candidates = data.candidates ?? [];
      renderShares(data.shares ?? []);
      renderCandidates();
      setStatus("Acesso removido.");
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao remover acesso"), true);
    } finally {
      setBusy(false);
    }
  }

  function open(nextId: string, kind: EntityKind = "lead") {
    leadId = nextId;
    apiKind = kind;
    setStatus("");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    void loadShares();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void addShare(select.value);
  });
  select.addEventListener("change", () => {
    addBtn.disabled = busy || !canManage || !select.value;
  });
  host.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-share-close]")) {
      close();
      return;
    }
    const removeId = target?.closest<HTMLElement>("[data-share-remove]")
      ?.dataset.shareRemove;
    if (removeId) void removeShare(removeId);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) close();
  });

  return { open, close };
}
