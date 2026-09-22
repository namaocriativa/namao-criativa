import { api } from "./api";
import { profileApi, type EntityKind } from "./profile-api";

type EmailKind =
  | "site-introduction"
  | "instagram-permission"
  | "credentials"
  | "package-offer";

type OfferPackage = {
  id: string;
  name: string;
  summary?: string | null;
  price?: number | null;
  promoPrice?: number | null;
  currency?: string | null;
};

type EmailListItem = {
  id: EmailKind;
  title: string;
  description: string;
  subject: string;
  to: string | null;
  available: boolean;
  unavailableReason: string | null;
  packages?: OfferPackage[];
};

type EmailPreview = {
  id: EmailKind;
  title: string;
  description: string;
  subject: string;
  to: string;
  html: string;
  notice?: string | null;
  canSend?: boolean;
  packageId?: string;
};

type SendResult = {
  sent?: boolean;
  alreadyConnected?: boolean;
  username?: string | null;
  to?: string;
  email?: string;
  message?: string | string[];
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function apiMessage(data: { message?: string | string[] }, fallback: string) {
  if (Array.isArray(data.message)) return data.message.join(" ");
  if (typeof data.message === "string" && data.message) return data.message;
  return fallback;
}

function previewHtml(html: string): string {
  const logo = `${window.location.origin}/logo.png`;
  return html.replace(/https?:\/\/[^"'>\s]+\/logo\.png/gi, logo);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatOfferPrice(pkg: OfferPackage): string {
  const currency = pkg.currency || "BRL";
  const money = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return null;
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
      }).format(value);
    } catch {
      return `${currency} ${value}`;
    }
  };
  const full = money(pkg.price);
  const promo = money(pkg.promoPrice);
  if (full && promo) return `de ${full} por ${promo}`;
  return full || "Sob consulta";
}

export function initLeadEmailsModal(
  host: HTMLElement,
  opts?: { onSent?: () => void },
): {
  open: (leadId: string, kind?: EntityKind) => void;
  close: () => void;
} {
  let leadId: string | null = null;
  let apiKind: EntityKind = "lead";
  let busy = false;
  let view: "list" | "packages" | "preview" = "list";
  let items: EmailListItem[] = [];
  let preview: EmailPreview | null = null;
  let sent = false;
  let selectedPackageId: string | null = null;

  host.innerHTML = `
    <div class="site-wizard-modal lead-emails-modal" hidden>
      <button
        type="button"
        class="site-wizard-modal__backdrop"
        data-emails-close
        aria-label="Fechar e-mails"
      ></button>
      <div
        class="site-wizard-modal__dialog lead-emails-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-emails-title"
      >
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Comunicação</p>
            <h3 id="lead-emails-title">E-mails</h3>
          </div>
          <button type="button" class="outline" data-emails-close>Fechar</button>
        </header>
        <div data-emails-list></div>
        <div class="lead-emails-preview" data-emails-preview hidden>
          <dl class="lead-emails-meta">
            <div>
              <dt>Assunto</dt>
              <dd data-emails-subject>—</dd>
            </div>
            <div>
              <dt>Para</dt>
              <dd data-emails-to>—</dd>
            </div>
          </dl>
          <p class="lead-emails-notice" data-emails-notice hidden></p>
          <iframe
            class="lead-emails-frame"
            data-emails-frame
            title="Prévia do e-mail"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
          ></iframe>
          <div class="lead-emails-actions">
            <button type="button" class="secondary" data-emails-back>Voltar</button>
            <button type="button" data-emails-send>Enviar</button>
          </div>
        </div>
        <p class="status" data-emails-status></p>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".lead-emails-modal")!;
  const titleEl = host.querySelector<HTMLElement>("#lead-emails-title")!;
  const listEl = host.querySelector<HTMLElement>("[data-emails-list]")!;
  const previewEl = host.querySelector<HTMLElement>("[data-emails-preview]")!;
  const subjectEl = host.querySelector<HTMLElement>("[data-emails-subject]")!;
  const toEl = host.querySelector<HTMLElement>("[data-emails-to]")!;
  const noticeEl = host.querySelector<HTMLElement>("[data-emails-notice]")!;
  const frameEl = host.querySelector<HTMLIFrameElement>("[data-emails-frame]")!;
  const statusEl = host.querySelector<HTMLElement>("[data-emails-status]")!;
  const backBtn = host.querySelector<HTMLButtonElement>("[data-emails-back]")!;
  const sendBtn = host.querySelector<HTMLButtonElement>("[data-emails-send]")!;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function canSendPreview(next: EmailPreview | null) {
    if (!next) return false;
    if (typeof next.canSend === "boolean") return next.canSend;
    return items.find((item) => item.id === next.id)?.available !== false;
  }

  function setBusy(next: boolean) {
    busy = next;
    sendBtn.disabled = next || sent || !canSendPreview(preview);
    backBtn.disabled = next;
    listEl.querySelectorAll<HTMLButtonElement>("[data-emails-kind]").forEach((btn) => {
      btn.disabled = next;
    });
    listEl.querySelectorAll<HTMLButtonElement>("[data-emails-package]").forEach((btn) => {
      btn.disabled = next;
    });
  }

  function showList() {
    view = "list";
    preview = null;
    sent = false;
    selectedPackageId = null;
    titleEl.textContent = "E-mails";
    listEl.hidden = false;
    previewEl.hidden = true;
    frameEl.srcdoc = "";
    sendBtn.disabled = true;
  }

  function offerItem() {
    return items.find((item) => item.id === "package-offer") || null;
  }

  function showPackagePicker() {
    const offer = offerItem();
    const packages = offer?.packages || [];
    view = "packages";
    preview = null;
    sent = false;
    titleEl.textContent = "Escolher pacote";
    listEl.hidden = false;
    previewEl.hidden = true;
    frameEl.srcdoc = "";
    sendBtn.disabled = true;
    if (!packages.length) {
      listEl.innerHTML = `<p class="lead-emails-empty">Nenhum pacote ativo cadastrado.</p>`;
      return;
    }
    listEl.innerHTML =
      `<p class="lead-emails-empty">Selecione o pacote para montar a proposta.</p>` +
      packages
        .map((pkg) => {
          const summary = escapeHtml(pkg.summary || "Sem resumo");
          const price = escapeHtml(formatOfferPrice(pkg));
          return `
          <button
            type="button"
            class="lead-emails-item"
            data-emails-package="${escapeHtml(pkg.id)}"
          >
            <strong>${escapeHtml(pkg.name)}</strong>
            <span>${summary}</span>
            <em>${price}</em>
          </button>
        `;
        })
        .join("") +
      `<div class="lead-emails-actions" style="margin-top:0.85rem">
        <button type="button" class="secondary" data-emails-packages-back>Voltar</button>
      </div>`;
  }

  function renderList(loading = false) {
    if (loading) {
      listEl.innerHTML = `<p class="lead-emails-empty">Carregando e-mails…</p>`;
      return;
    }
    if (!items.length) {
      listEl.innerHTML = `<p class="lead-emails-empty">Nenhum e-mail disponível.</p>`;
      return;
    }
    listEl.innerHTML = items
      .map((item) => {
        const to =
          !item.available && item.unavailableReason
            ? escapeHtml(item.unavailableReason)
            : item.to
              ? `Para ${escapeHtml(item.to)}`
              : escapeHtml(item.unavailableReason || "Indisponível");
        return `
          <button
            type="button"
            class="lead-emails-item${item.available ? "" : " lead-emails-item--blocked"}"
            data-emails-kind="${item.id}"
            data-available="${item.available ? "1" : "0"}"
          >
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.description)}</span>
            <em>${to}</em>
          </button>
        `;
      })
      .join("");
  }

  function showPreview(next: EmailPreview) {
    view = "preview";
    preview = next;
    sent = false;
    titleEl.textContent = next.title;
    listEl.hidden = true;
    previewEl.hidden = false;
    subjectEl.textContent = next.subject;
    toEl.textContent = next.to;
    if (next.notice) {
      noticeEl.hidden = false;
      noticeEl.textContent = next.notice;
    } else {
      noticeEl.hidden = true;
      noticeEl.textContent = "";
    }
    frameEl.srcdoc = previewHtml(next.html);
    sendBtn.disabled = busy || sent || !canSendPreview(next);
    setStatus("");
  }

  async function loadList() {
    if (!leadId) return;
    setBusy(true);
    setStatus("Carregando e-mails…");
    try {
      const res = await api(profileApi(apiKind, leadId, "/emails"));
      const data = (await res.json().catch(() => ({}))) as {
        items?: EmailListItem[];
        message?: string | string[];
      };
      if (!res.ok) {
        throw new Error(apiMessage(data, "Falha ao carregar e-mails"));
      }
      items = data.items ?? [];
      renderList();
      showList();
      setStatus("");
    } catch (error) {
      items = [];
      renderList();
      setStatus(errorMessage(error, "Falha ao carregar e-mails"), true);
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(kind: EmailKind, packageId?: string) {
    if (!leadId || busy) return;
    setBusy(true);
    setStatus("Carregando prévia…");
    try {
      const query =
        kind === "package-offer" && packageId
          ? `?packageId=${encodeURIComponent(packageId)}`
          : "";
      const res = await api(
        profileApi(
          apiKind,
          leadId,
          `/emails/${encodeURIComponent(kind)}/preview${query}`,
        ),
      );
      const data = (await res.json().catch(() => ({}))) as EmailPreview & {
        message?: string | string[];
      };
      if (!res.ok) {
        throw new Error(apiMessage(data, "Falha ao carregar prévia"));
      }
      showPreview(data);
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao carregar prévia"), true);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!leadId || !preview || busy || sent) return;
    setBusy(true);
    setStatus("Enviando…");
    try {
      const res = await api(
        profileApi(apiKind, leadId, `/emails/${encodeURIComponent(preview.id)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: preview.packageId || selectedPackageId || undefined,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as SendResult;
      if (!res.ok) {
        throw new Error(apiMessage(data, "Falha ao enviar e-mail"));
      }
      sent = true;
      sendBtn.disabled = true;
      if (data.alreadyConnected) {
        setStatus(
          data.username
            ? `Instagram já autorizado (@${data.username}).`
            : "Instagram já autorizado por este lead.",
        );
        return;
      }
      const to = data.to || data.email || preview.to;
      setStatus(to ? `E-mail enviado para ${to}.` : "E-mail enviado.");
      opts?.onSent?.();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao enviar e-mail"), true);
    } finally {
      busy = false;
      backBtn.disabled = false;
      sendBtn.disabled = sent || !canSendPreview(preview);
    }
  }

  function close() {
    if (busy) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    setStatus("");
    leadId = null;
    items = [];
    preview = null;
    sent = false;
    selectedPackageId = null;
    frameEl.srcdoc = "";
  }

  function open(nextId: string, kind: EntityKind = "lead") {
    leadId = nextId;
    apiKind = kind;
    items = [];
    preview = null;
    sent = false;
    selectedPackageId = null;
    renderList(true);
    showList();
    setStatus("");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    void loadList();
  }

  host.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-emails-close]")) {
      close();
      return;
    }
    if (target?.closest("[data-emails-packages-back]")) {
      showList();
      setStatus("");
      void loadList();
      return;
    }
    const packageId = target?.closest<HTMLElement>("[data-emails-package]")
      ?.dataset.emailsPackage;
    if (packageId) {
      selectedPackageId = packageId;
      void openPreview("package-offer", packageId);
      return;
    }
    const kind = target?.closest<HTMLElement>("[data-emails-kind]")?.dataset
      .emailsKind;
    if (
      kind === "site-introduction" ||
      kind === "instagram-permission" ||
      kind === "credentials"
    ) {
      void openPreview(kind);
      return;
    }
    if (kind === "package-offer") {
      const offer = offerItem();
      if (!offer?.available) {
        setStatus(offer?.unavailableReason || "Pacote indisponível.", true);
        return;
      }
      showPackagePicker();
      setStatus("");
    }
  });

  backBtn.addEventListener("click", () => {
    if (busy) return;
    setStatus("");
    if (view === "preview" && preview?.id === "package-offer") {
      showPackagePicker();
      return;
    }
    showList();
    void loadList();
  });
  sendBtn.addEventListener("click", () => {
    void send();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || modal.hidden || busy) return;
    if (view === "preview" && preview?.id === "package-offer") {
      showPackagePicker();
      setStatus("");
      return;
    }
    if (view === "preview" || view === "packages") {
      showList();
      setStatus("");
      if (view === "list") void loadList();
      return;
    }
    close();
  });

  return { open, close };
}
