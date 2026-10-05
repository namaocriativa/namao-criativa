import { api } from "./api";
import { entityKindOf, profileApi, type EntityKind } from "./profile-api";
import type { Lead, LeadImage } from "./types";

export type BrandIdentity = {
  logoImageId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  headingFont?: string;
  bodyFont?: string;
  voice?: string;
  logoAppearance?: string;
};

export const DEFAULT_LOGO_APPEARANCE =
  "canto inferior direito, discreto, ~8% da largura";

const FONT_OPTIONS = [
  "Inter",
  "Montserrat",
  "Poppins",
  "Roboto",
  "Playfair Display",
  "Georgia",
  "Helvetica Neue",
];

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imageSrc(img: LeadImage): string {
  const path = img.localPath.replace(/^\/+/, "");
  return `/${path}`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeHex(value: string): string {
  const text = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(text)) return `#${text.toUpperCase()}`;
  return text;
}

export function hasUsefulBrandIdentity(identity: BrandIdentity | null | undefined): boolean {
  if (!identity) return false;
  return Boolean(
    identity.logoImageId ||
      identity.primaryColor ||
      identity.secondaryColor ||
      identity.accentColor ||
      identity.backgroundColor ||
      identity.headingFont ||
      identity.bodyFont ||
      identity.voice,
  );
}

export function initBrandIdentityModal(
  host: HTMLElement,
  opts: { onSaved?: (lead: Lead) => void } = {},
): {
  open: (lead: Lead) => void;
  close: () => void;
} {
  let lead: Lead | null = null;
  let kind: EntityKind = "lead";
  let busy = false;
  let identity: BrandIdentity = {};
  let selectedLogoId = "";

  host.innerHTML = `
    <div class="site-wizard-modal brand-identity-modal" hidden>
      <button type="button" class="site-wizard-modal__backdrop" data-brand-close aria-label="Fechar"></button>
      <div class="site-wizard-modal__dialog brand-identity-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="brand-identity-title">
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Perfil</p>
            <h3 id="brand-identity-title">Identidade da marca</h3>
          </div>
          <button type="button" class="outline" data-brand-close>Fechar</button>
        </header>
        <p class="lead-share-hint">Cores, fontes e logo usados na produção do plano de conteúdo.</p>
        <div class="brand-identity-body">
          <section class="brand-identity-logo">
            <h4>Logo</h4>
            <div class="brand-identity-logo-preview" data-brand-logo-preview>
              <p class="meta">Nenhum logo selecionado</p>
            </div>
            <div class="brand-identity-logo-actions">
              <label class="lead-gallery-upload">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-brand-upload />
                Enviar logo
              </label>
              <button type="button" class="outline" data-brand-clear-logo>Remover logo</button>
            </div>
            <ul class="brand-identity-gallery" data-brand-gallery></ul>
          </section>
          <section class="brand-identity-colors">
            <h4>Cores</h4>
            ${colorField("primaryColor", "Primária")}
            ${colorField("secondaryColor", "Secundária")}
            ${colorField("accentColor", "Destaque")}
            ${colorField("backgroundColor", "Fundo")}
          </section>
          <section class="brand-identity-fonts">
            <h4>Fontes</h4>
            <label>Títulos
              <select data-brand-heading-font>
                <option value="">—</option>
                ${FONT_OPTIONS.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("")}
              </select>
            </label>
            <label>Corpo
              <select data-brand-body-font>
                <option value="">—</option>
                ${FONT_OPTIONS.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("")}
              </select>
            </label>
          </section>
          <section>
            <label>Tom / voz
              <textarea data-brand-voice rows="3" maxlength="240" placeholder="Ex.: próximo, direto, sem jargão"></textarea>
            </label>
          </section>
        </div>
        <footer class="brand-identity-footer">
          <p class="status" data-brand-status></p>
          <div class="actions">
            <button type="button" class="outline" data-brand-close>Cancelar</button>
            <button type="button" data-brand-save>Salvar</button>
          </div>
        </footer>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".brand-identity-modal")!;
  const status = host.querySelector<HTMLElement>("[data-brand-status]")!;
  const gallery = host.querySelector<HTMLElement>("[data-brand-gallery]")!;
  const logoPreview = host.querySelector<HTMLElement>("[data-brand-logo-preview]")!;
  const uploadInput = host.querySelector<HTMLInputElement>("[data-brand-upload]")!;
  const headingFont = host.querySelector<HTMLSelectElement>("[data-brand-heading-font]")!;
  const bodyFont = host.querySelector<HTMLSelectElement>("[data-brand-body-font]")!;
  const voice = host.querySelector<HTMLTextAreaElement>("[data-brand-voice]")!;

  function setStatus(message: string, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    busy = false;
    setStatus("");
  }

  function paintLogoPreview() {
    const images = lead?.images || [];
    const selected = images.find((img) => img.id && img.id === selectedLogoId);
    if (!selected) {
      logoPreview.innerHTML = `<p class="meta">Nenhum logo selecionado</p>`;
      return;
    }
    logoPreview.innerHTML = `<img src="${escapeHtml(imageSrc(selected))}" alt="${escapeHtml(selected.filename || "Logo")}" />`;
  }

  function paintGallery() {
    const images = lead?.images || [];
    gallery.innerHTML = images
      .map((img) => {
        const id = img.id || "";
        const active = id && id === selectedLogoId;
        return `<li>
          <button type="button" class="brand-identity-thumb${active ? " is-active" : ""}" data-brand-pick="${escapeHtml(id)}" ${id ? "" : "disabled"}>
            <img src="${escapeHtml(imageSrc(img))}" alt="${escapeHtml(img.filename || "Imagem")}" loading="lazy" />
          </button>
        </li>`;
      })
      .join("");
  }

  function fillForm(next: BrandIdentity) {
    identity = { ...next };
    selectedLogoId = next.logoImageId || "";
    for (const key of [
      "primaryColor",
      "secondaryColor",
      "accentColor",
      "backgroundColor",
    ] as const) {
      const hex = next[key] || "#000000";
      const colorInput = host.querySelector<HTMLInputElement>(`[data-brand-color="${key}"]`);
      const hexInput = host.querySelector<HTMLInputElement>(`[data-brand-hex="${key}"]`);
      if (colorInput) colorInput.value = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#000000";
      if (hexInput) hexInput.value = next[key] || "";
    }
    ensureFontOption(headingFont, next.headingFont);
    ensureFontOption(bodyFont, next.bodyFont);
    headingFont.value = next.headingFont || "";
    bodyFont.value = next.bodyFont || "";
    voice.value = next.voice || "";
    paintLogoPreview();
    paintGallery();
  }

  function ensureFontOption(select: HTMLSelectElement, value?: string) {
    const text = String(value || "").trim();
    if (!text) return;
    if ([...select.options].some((opt) => opt.value === text)) return;
    const opt = document.createElement("option");
    opt.value = text;
    opt.textContent = text;
    select.appendChild(opt);
  }

  function readForm(): BrandIdentity {
    const next: BrandIdentity = {};
    if (selectedLogoId) next.logoImageId = selectedLogoId;
    for (const key of [
      "primaryColor",
      "secondaryColor",
      "accentColor",
      "backgroundColor",
    ] as const) {
      const hexInput = host.querySelector<HTMLInputElement>(`[data-brand-hex="${key}"]`);
      const raw = normalizeHex(hexInput?.value || "");
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) next[key] = raw.toUpperCase();
    }
    if (headingFont.value.trim()) next.headingFont = headingFont.value.trim();
    if (bodyFont.value.trim()) next.bodyFont = bodyFont.value.trim();
    if (voice.value.trim()) next.voice = voice.value.trim();
    return next;
  }

  async function loadIdentity() {
    if (!lead?.id) return;
    setStatus("Carregando…");
    try {
      const res = await api(profileApi(kind, lead.id, "/brand-identity"));
      if (!res.ok) throw new Error("Não carregou a identidade");
      const data = (await res.json()) as BrandIdentity;
      fillForm(data || {});
      setStatus("");
    } catch (error) {
      fillForm({});
      setStatus(errorMessage(error, "Falha ao carregar identidade"), true);
    }
  }

  async function refreshLeadImages() {
    if (!lead?.id) return;
    const res = await api(profileApi(kind, lead.id));
    if (!res.ok) return;
    const data = (await res.json()) as Lead;
    lead = { ...lead, ...data, _entityKind: kind };
    paintGallery();
    paintLogoPreview();
    opts.onSaved?.(lead);
  }

  async function open(next: Lead) {
    lead = next;
    kind = entityKindOf(next);
    busy = false;
    setStatus("");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    paintGallery();
    await loadIdentity();
  }

  modal.querySelectorAll("[data-brand-close]").forEach((el) => {
    el.addEventListener("click", () => close());
  });

  gallery.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-brand-pick]");
    if (!btn || busy) return;
    selectedLogoId = btn.dataset.brandPick || "";
    paintLogoPreview();
    paintGallery();
  });

  host.querySelector("[data-brand-clear-logo]")?.addEventListener("click", () => {
    selectedLogoId = "";
    paintLogoPreview();
    paintGallery();
  });

  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files?.[0];
    uploadInput.value = "";
    if (!file || !lead?.id || busy) return;
    busy = true;
    setStatus("Enviando logo…");
    try {
      const body = new FormData();
      body.append("files", file);
      const res = await api(profileApi(kind, lead.id, "/images"), {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.message === "string" ? data.message : "Falha no upload",
        );
      }
      await refreshLeadImages();
      const uploaded = (lead?.images || []).slice().reverse().find((img) => img.id);
      if (uploaded?.id) {
        selectedLogoId = uploaded.id;
        paintLogoPreview();
        paintGallery();
      }
      setStatus("Logo enviado");
    } catch (error) {
      setStatus(errorMessage(error, "Falha no upload"), true);
    } finally {
      busy = false;
    }
  });

  for (const key of [
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
  ] as const) {
    const colorInput = host.querySelector<HTMLInputElement>(`[data-brand-color="${key}"]`);
    const hexInput = host.querySelector<HTMLInputElement>(`[data-brand-hex="${key}"]`);
    colorInput?.addEventListener("input", () => {
      if (hexInput) hexInput.value = colorInput.value.toUpperCase();
    });
    hexInput?.addEventListener("change", () => {
      const raw = normalizeHex(hexInput.value);
      if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
        hexInput.value = raw.toUpperCase();
        if (colorInput) colorInput.value = raw.toUpperCase();
      }
    });
  }

  host.querySelector("[data-brand-save]")?.addEventListener("click", async () => {
    if (!lead?.id || busy) return;
    const payload = readForm();
    for (const key of [
      "primaryColor",
      "secondaryColor",
      "accentColor",
      "backgroundColor",
    ] as const) {
      const hexInput = host.querySelector<HTMLInputElement>(`[data-brand-hex="${key}"]`);
      const raw = (hexInput?.value || "").trim();
      if (raw && !/^#[0-9a-fA-F]{6}$/.test(normalizeHex(raw))) {
        setStatus(`${key} deve ser #RRGGBB`, true);
        return;
      }
    }
    busy = true;
    setStatus("Salvando…");
    try {
      const res = await api(profileApi(kind, lead.id, "/brand-identity"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.message === "string"
            ? data.message
            : Array.isArray(data?.message)
              ? data.message.join(", ")
              : "Não salvou a identidade",
        );
      }
      identity = data as BrandIdentity;
      fillForm(identity);
      setStatus("Identidade salva");
      opts.onSaved?.(lead);
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao salvar"), true);
    } finally {
      busy = false;
    }
  });

  return { open, close };
}

function colorField(key: string, label: string): string {
  return `<label class="brand-identity-color">
    <span>${escapeHtml(label)}</span>
    <span class="brand-identity-color__inputs">
      <input type="color" data-brand-color="${escapeHtml(key)}" value="#000000" />
      <input type="text" data-brand-hex="${escapeHtml(key)}" maxlength="7" placeholder="#RRGGBB" />
    </span>
  </label>`;
}
