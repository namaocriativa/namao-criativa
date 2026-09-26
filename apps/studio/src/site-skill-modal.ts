import { api } from "./api";
import {
  CUSTOM_VALUE,
  modelSelectHtml,
  readPickerModel,
  type LlmRole,
} from "./llm-catalog";
import type { EntityKind } from "./profile-api";
import type { Lead } from "./types";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type LlmPayload = {
  gemini?: { models?: string[] };
  settings?: { roles?: { code?: { model?: string } } };
  defaults?: { gemini?: { code?: string } };
};

export function initSiteSkillModal(
  host: HTMLElement,
  opts: { onStarted: (jobId: string) => void },
): {
  open: (leadId: string, kind?: EntityKind, current?: Lead | null) => void;
  close: () => void;
} {
  let leadId: string | null = null;
  let kind: EntityKind = "lead";
  let current: Lead | null = null;
  let busy = false;

  host.innerHTML = `
    <div class="site-wizard-modal site-skill-modal" hidden>
      <button type="button" class="site-wizard-modal__backdrop" data-skill-close aria-label="Fechar"></button>
      <div class="site-wizard-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="site-skill-title">
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Skill</p>
            <h3 id="site-skill-title">Skill site lead</h3>
          </div>
          <button type="button" class="outline" data-skill-close>Fechar</button>
        </header>
        <p class="lead-share-hint">Vite + React + TypeScript. Cria o repo na Namão, gera o site e clona em websites/. Não publica.</p>
        <label>Modelo de código
          <select data-skill-model></select>
        </label>
        <label data-skill-custom-wrap hidden>Modelo personalizado
          <input data-skill-custom placeholder="gemini-…" />
        </label>
        <p class="meta" data-skill-cost>Estimando custo…</p>
        <label>Imagens para o site
          <input type="file" data-skill-files accept="image/*,video/*" multiple />
        </label>
        <div data-skill-gallery></div>
        <label>Detalhe / estilo
          <textarea data-skill-notes rows="3" maxlength="4000" placeholder="Tom, cores, oferta, o que evitar."></textarea>
        </label>
        <p class="status" data-skill-status></p>
        <div class="actions">
          <button type="button" data-skill-submit>Gerar site</button>
        </div>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".site-skill-modal")!;
  const modelSelect = host.querySelector<HTMLSelectElement>("[data-skill-model]")!;
  const customInput = host.querySelector<HTMLInputElement>("[data-skill-custom]")!;
  const customWrap = host.querySelector<HTMLElement>("[data-skill-custom-wrap]")!;
  const costEl = host.querySelector<HTMLElement>("[data-skill-cost]")!;
  const filesInput = host.querySelector<HTMLInputElement>("[data-skill-files]")!;
  const gallery = host.querySelector<HTMLElement>("[data-skill-gallery]")!;
  const notes = host.querySelector<HTMLTextAreaElement>("[data-skill-notes]")!;
  const status = host.querySelector<HTMLElement>("[data-skill-status]")!;

  function close() {
    modal.hidden = true;
    busy = false;
  }

  function selectedModel() {
    return readPickerModel(modelSelect.value, customInput.value);
  }

  async function refreshCost() {
    const model = selectedModel();
    try {
      const res = await api(`/site-skill/estimate?model=${encodeURIComponent(model)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { label?: string };
      costEl.textContent = data.label || "";
    } catch {
      costEl.textContent = "";
    }
  }

  async function loadModels() {
    let live: string[] = [];
    let selected = "gemini-2.5-pro";
    try {
      const res = await api("/config/llm");
      if (res.ok) {
        const data = (await res.json()) as LlmPayload;
        live = data.gemini?.models || [];
        selected =
          data.settings?.roles?.code?.model ||
          data.defaults?.gemini?.code ||
          "gemini-2.5-pro";
      }
    } catch {
      /* catalog local */
    }
    const picker = modelSelectHtml("code" as LlmRole, live, selected);
    modelSelect.innerHTML = picker.html;
    modelSelect.value = picker.value;
    customInput.value = picker.custom;
    customWrap.hidden = picker.value !== CUSTOM_VALUE;
    await refreshCost();
  }

  function paintGallery() {
    const images = current?.images || [];
    if (!images.length) {
      gallery.innerHTML = "";
      return;
    }
    gallery.innerHTML = `<p class="meta">Ou use fotos do perfil</p><div class="site-skill-gallery">${images
      .map(
        (img) =>
          `<label class="site-skill-pick"><input type="checkbox" data-image-id="${escapeHtml(img.filename || img.id)}" checked /> ${escapeHtml(img.filename || img.id)}</label>`,
      )
      .join("")}</div>`;
  }

  async function submit() {
    if (!leadId || busy) return;
    busy = true;
    status.textContent = "Enviando…";
    const data = new FormData();
    if (kind === "customer") data.set("customerId", leadId);
    else data.set("leadId", leadId);
    data.set("model", selectedModel());
    data.set("notes", notes.value.trim());
    const ids = [...host.querySelectorAll<HTMLInputElement>("[data-image-id]:checked")]
      .map((input) => input.dataset.imageId || "")
      .filter(Boolean);
    if (ids.length) data.set("imageIds", ids.join(","));
    for (const file of filesInput.files || []) data.append("files", file);
    try {
      const res = await api("/site-skill/generate", { method: "POST", body: data });
      const payload = (await res.json()) as { id?: string; message?: string };
      if (!res.ok || !payload.id) {
        throw new Error(payload.message || "Não iniciou a skill");
      }
      close();
      opts.onStarted(payload.id);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Falha";
      busy = false;
    }
  }

  host.addEventListener("click", (event) => {
    const node = event.target as HTMLElement;
    if (node.closest("[data-skill-close]")) {
      close();
      return;
    }
    if (node.closest("[data-skill-submit]")) {
      void submit();
    }
  });
  modelSelect.addEventListener("change", () => {
    customWrap.hidden = modelSelect.value !== CUSTOM_VALUE;
    void refreshCost();
  });
  customInput.addEventListener("input", () => void refreshCost());

  return {
    open(id, nextKind = "lead", lead = null) {
      leadId = id;
      kind = nextKind;
      current = lead;
      notes.value = "";
      filesInput.value = "";
      status.textContent = "";
      paintGallery();
      modal.hidden = false;
      void loadModels();
    },
    close,
  };
}
