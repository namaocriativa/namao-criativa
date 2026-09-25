import { api } from "./api";
import { profileApi, type EntityKind } from "./profile-api";

type WhatsAppKind =
  | "site-introduction"
  | "instagram-permission"
  | "credentials"
  | "package-offer"
  | "proposal";

function needsPackage(kind: string): kind is "package-offer" | "proposal" {
  return kind === "package-offer" || kind === "proposal";
}

type OfferPackage = {
  id: string;
  name: string;
  summary?: string | null;
  price?: number | null;
  promoPrice?: number | null;
  currency?: string | null;
};

type WhatsAppListItem = {
  id: WhatsAppKind;
  title: string;
  description: string;
  to: string | null;
  available: boolean;
  unavailableReason: string | null;
  packages?: OfferPackage[];
};

type WhatsAppPreview = {
  id: WhatsAppKind;
  title: string;
  description: string;
  to: string;
  text: string;
  notice?: string | null;
  canSend?: boolean;
  packageId?: string;
};

type SendResult = {
  sent?: boolean;
  alreadyConnected?: boolean;
  username?: string | null;
  to?: string;
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

export function initLeadWhatsAppModal(
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
  let items: WhatsAppListItem[] = [];
  let preview: WhatsAppPreview | null = null;
  let sent = false;
  let selectedPackageId: string | null = null;
  let packageKind: "package-offer" | "proposal" = "package-offer";

  host.innerHTML = `
    <div class="site-wizard-modal lead-emails-modal lead-whatsapp-modal" hidden>
      <button
        type="button"
        class="site-wizard-modal__backdrop"
        data-wpp-close
        aria-label="Fechar mensagens de WhatsApp"
      ></button>
      <div
        class="site-wizard-modal__dialog lead-emails-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-whatsapp-title"
      >
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Comunicação</p>
            <h3 id="lead-whatsapp-title">WhatsApp</h3>
          </div>
          <button type="button" class="outline" data-wpp-close>Fechar</button>
        </header>
        <div data-wpp-list></div>
        <div class="lead-emails-preview" data-wpp-preview hidden>
          <dl class="lead-emails-meta">
            <div>
              <dt>Para</dt>
              <dd data-wpp-to>—</dd>
            </div>
          </dl>
          <p class="lead-emails-notice" data-wpp-notice hidden></p>
          <label class="lead-whatsapp-label" for="lead-whatsapp-editor">Mensagem</label>
          <textarea
            id="lead-whatsapp-editor"
            class="lead-whatsapp-editor"
            data-wpp-text
            rows="12"
          ></textarea>
          <div class="lead-emails-actions">
            <button type="button" class="secondary" data-wpp-back>Voltar</button>
            <button type="button" data-wpp-send>Enviar</button>
          </div>
        </div>
        <p class="status" data-wpp-status></p>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".lead-whatsapp-modal")!;
  const titleEl = host.querySelector<HTMLElement>("#lead-whatsapp-title")!;
  const listEl = host.querySelector<HTMLElement>("[data-wpp-list]")!;
  const previewEl = host.querySelector<HTMLElement>("[data-wpp-preview]")!;
  const toEl = host.querySelector<HTMLElement>("[data-wpp-to]")!;
  const noticeEl = host.querySelector<HTMLElement>("[data-wpp-notice]")!;
  const textEl = host.querySelector<HTMLTextAreaElement>("[data-wpp-text]")!;
  const statusEl = host.querySelector<HTMLElement>("[data-wpp-status]")!;
  const backBtn = host.querySelector<HTMLButtonElement>("[data-wpp-back]")!;
  const sendBtn = host.querySelector<HTMLButtonElement>("[data-wpp-send]")!;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function canSendPreview(next: WhatsAppPreview | null) {
    if (!next) return false;
    if (typeof next.canSend === "boolean") return next.canSend;
    return items.find((item) => item.id === next.id)?.available !== false;
  }

  function setBusy(next: boolean) {
    busy = next;
    sendBtn.disabled = next || sent || !canSendPreview(preview);
    backBtn.disabled = next;
    textEl.disabled = next || sent;
    listEl.querySelectorAll<HTMLButtonElement>("[data-wpp-kind]").forEach((btn) => {
      btn.disabled = next;
    });
    listEl.querySelectorAll<HTMLButtonElement>("[data-wpp-package]").forEach((btn) => {
      btn.disabled = next;
    });
  }

  function showList() {
    view = "list";
    preview = null;
    sent = false;
    selectedPackageId = null;
    titleEl.textContent = "WhatsApp";
    listEl.hidden = false;
    previewEl.hidden = true;
    textEl.value = "";
    sendBtn.disabled = true;
  }

  function offerItem() {
    return items.find((item) => item.id === packageKind) || null;
  }

  function showPackagePicker(kind: "package-offer" | "proposal") {
    packageKind = kind;
    const offer = offerItem();
    const packages = offer?.packages || [];
    view = "packages";
    preview = null;
    sent = false;
    titleEl.textContent = "Escolher pacote";
    listEl.hidden = false;
    previewEl.hidden = true;
    textEl.value = "";
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
            data-wpp-package="${escapeHtml(pkg.id)}"
          >
            <strong>${escapeHtml(pkg.name)}</strong>
            <span>${summary}</span>
            <em>${price}</em>
          </button>
        `;
        })
        .join("") +
      `<div class="lead-emails-actions" style="margin-top:0.85rem">
        <button type="button" class="secondary" data-wpp-packages-back>Voltar</button>
      </div>`;
  }

  function renderList(loading = false) {
    if (loading) {
      listEl.innerHTML = `<p class="lead-emails-empty">Carregando mensagens…</p>`;
      return;
    }
    if (!items.length) {
      listEl.innerHTML = `<p class="lead-emails-empty">Nenhuma mensagem disponível.</p>`;
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
            data-wpp-kind="${item.id}"
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

  function showPreview(next: WhatsAppPreview) {
    view = "preview";
    preview = next;
    sent = false;
    titleEl.textContent = next.title;
    listEl.hidden = true;
    previewEl.hidden = false;
    toEl.textContent = next.to;
    textEl.value = next.text;
    textEl.disabled = false;
    if (next.notice) {
      noticeEl.hidden = false;
      noticeEl.textContent = next.notice;
    } else {
      noticeEl.hidden = true;
      noticeEl.textContent = "";
    }
    sendBtn.disabled = busy || sent || !canSendPreview(next);
    setStatus("");
  }

  async function loadList() {
    if (!leadId) return;
    setBusy(true);
    setStatus("Carregando mensagens…");
    try {
      const res = await api(profileApi(apiKind, leadId, "/whatsapp"));
      const data = (await res.json().catch(() => ({}))) as {
        items?: WhatsAppListItem[];
        message?: string | string[];
      };
      if (!res.ok) {
        throw new Error(apiMessage(data, "Falha ao carregar mensagens"));
      }
      items = data.items ?? [];
      renderList();
      showList();
      setStatus("");
    } catch (error) {
      items = [];
      renderList();
      setStatus(errorMessage(error, "Falha ao carregar mensagens"), true);
    } finally {
      setBusy(false);
    }
  }

  async function openPreview(kind: WhatsAppKind, packageId?: string) {
    if (!leadId || busy) return;
    setBusy(true);
    setStatus("Carregando prévia…");
    try {
      const query =
        needsPackage(kind) && packageId
          ? `?packageId=${encodeURIComponent(packageId)}`
          : "";
      const res = await api(
        profileApi(
          apiKind,
          leadId,
          `/whatsapp/${encodeURIComponent(kind)}/preview${query}`,
        ),
      );
      const data = (await res.json().catch(() => ({}))) as WhatsAppPreview & {
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
        profileApi(apiKind, leadId, `/whatsapp/${encodeURIComponent(preview.id)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: textEl.value,
            packageId: preview.packageId || selectedPackageId || undefined,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as SendResult;
      if (!res.ok) {
        throw new Error(apiMessage(data, "Falha ao enviar WhatsApp"));
      }
      sent = true;
      sendBtn.disabled = true;
      textEl.disabled = true;
      if (data.alreadyConnected) {
        setStatus(
          data.username
            ? `Instagram já autorizado (@${data.username}).`
            : "Instagram já autorizado por este lead.",
        );
        return;
      }
      const to = data.to || preview.to;
      setStatus(to ? `WhatsApp enviado para ${to}.` : "WhatsApp enviado.");
      opts?.onSent?.();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao enviar WhatsApp"), true);
    } finally {
      busy = false;
      backBtn.disabled = false;
      sendBtn.disabled = sent || !canSendPreview(preview);
      textEl.disabled = sent;
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
    textEl.value = "";
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
    if (target?.closest("[data-wpp-close]")) {
      close();
      return;
    }
    if (target?.closest("[data-wpp-packages-back]")) {
      showList();
      setStatus("");
      void loadList();
      return;
    }
    const packageId = target?.closest<HTMLElement>("[data-wpp-package]")?.dataset
      .wppPackage;
    if (packageId) {
      selectedPackageId = packageId;
      void openPreview(packageKind, packageId);
      return;
    }
    const kind = target?.closest<HTMLElement>("[data-wpp-kind]")?.dataset.wppKind;
    if (
      kind === "site-introduction" ||
      kind === "instagram-permission" ||
      kind === "credentials"
    ) {
      void openPreview(kind);
      return;
    }
    if (needsPackage(kind)) {
      packageKind = kind;
      const offer = offerItem();
      if (!offer?.available) {
        setStatus(offer?.unavailableReason || "Pacote indisponível.", true);
        return;
      }
      showPackagePicker(kind);
      setStatus("");
    }
  });

  backBtn.addEventListener("click", () => {
    if (busy) return;
    setStatus("");
    if (view === "preview" && preview && needsPackage(preview.id)) {
      showPackagePicker(preview.id);
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
    if (view === "preview" && preview && needsPackage(preview.id)) {
      showPackagePicker(preview.id);
      setStatus("");
      return;
    }
    if (view === "preview" || view === "packages") {
      showList();
      setStatus("");
      void loadList();
      return;
    }
    close();
  });

  return { open, close };
}
