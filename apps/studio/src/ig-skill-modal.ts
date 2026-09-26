import { api } from "./api";
import {
  CUSTOM_VALUE,
  modelSelectHtml,
  readPickerModel,
  type LlmRole,
} from "./llm-catalog";
import type { EntityKind } from "./profile-api";
import type { Lead } from "./types";

type LlmPayload = {
  gemini?: { models?: string[] };
  settings?: { roles?: { plan?: { model?: string } } };
  defaults?: { gemini?: { plan?: string } };
};

export function initIgSkillModal(
  host: HTMLElement,
  opts: {
    onStarted: (jobId: string) => void;
    onOpenReport?: () => void;
  },
): {
  open: (leadId: string, kind?: EntityKind, current?: Lead | null) => void;
  close: () => void;
} {
  let leadId: string | null = null;
  let kind: EntityKind = "lead";
  let busy = false;

  host.innerHTML = `
    <div class="site-wizard-modal ig-skill-modal" hidden>
      <button type="button" class="site-wizard-modal__backdrop" data-ig-close aria-label="Fechar"></button>
      <div class="site-wizard-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="ig-skill-title">
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Skill</p>
            <h3 id="ig-skill-title">Skill Instagram</h3>
          </div>
          <button type="button" class="outline" data-ig-close>Fechar</button>
        </header>
        <p class="lead-share-hint">Lê o feed da conta conectada (sem insights) e monta overview, pilares e 5 ideias para a agenda.</p>
        <label>Modelo
          <select data-ig-model></select>
        </label>
        <label data-ig-custom-wrap hidden>Modelo personalizado
          <input data-ig-custom placeholder="gemini-…" />
        </label>
        <p class="meta" data-ig-cost>Estimando custo…</p>
        <label>Janela
          <select data-ig-days>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
          </select>
        </label>
        <label>Notas
          <textarea data-ig-notes rows="3" maxlength="4000" placeholder="Foco, oferta, o que evitar."></textarea>
        </label>
        <p class="status" data-ig-status></p>
        <div class="actions">
          <button type="button" class="secondary" data-ig-latest hidden>Ver último relatório</button>
          <button type="button" data-ig-submit>Analisar feed</button>
        </div>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".ig-skill-modal")!;
  const modelSelect = host.querySelector<HTMLSelectElement>("[data-ig-model]")!;
  const customInput = host.querySelector<HTMLInputElement>("[data-ig-custom]")!;
  const customWrap = host.querySelector<HTMLElement>("[data-ig-custom-wrap]")!;
  const costEl = host.querySelector<HTMLElement>("[data-ig-cost]")!;
  const daysSelect = host.querySelector<HTMLSelectElement>("[data-ig-days]")!;
  const notes = host.querySelector<HTMLTextAreaElement>("[data-ig-notes]")!;
  const status = host.querySelector<HTMLElement>("[data-ig-status]")!;
  const latestBtn = host.querySelector<HTMLButtonElement>("[data-ig-latest]")!;

  function close() {
    modal.hidden = true;
    busy = false;
  }

  function selectedModel() {
    return readPickerModel(modelSelect.value, customInput.value);
  }

  async function refreshCost() {
    try {
      const res = await api(`/ig-skill/estimate?model=${encodeURIComponent(selectedModel())}`);
      if (!res.ok) return;
      const data = (await res.json()) as { label?: string };
      costEl.textContent = data.label || "";
    } catch {
      costEl.textContent = "";
    }
  }

  async function loadModels() {
    let live: string[] = [];
    let selected = "gemini-2.5-flash";
    try {
      const res = await api("/config/llm");
      if (res.ok) {
        const data = (await res.json()) as LlmPayload;
        live = data.gemini?.models || [];
        selected =
          data.settings?.roles?.plan?.model ||
          data.defaults?.gemini?.plan ||
          "gemini-2.5-flash";
      }
    } catch {
      /* catalog */
    }
    const picker = modelSelectHtml("plan" as LlmRole, live, selected);
    modelSelect.innerHTML = picker.html;
    modelSelect.value = picker.value;
    customInput.value = picker.custom;
    customWrap.hidden = picker.value !== CUSTOM_VALUE;
    await refreshCost();
  }

  async function loadLatestFlag() {
    if (!leadId) return;
    const qs = kind === "customer" ? `customerId=${encodeURIComponent(leadId)}` : `leadId=${encodeURIComponent(leadId)}`;
    try {
      const res = await api(`/ig-skill/latest?${qs}`);
      const data = (await res.json()) as { job?: { id?: string } | null };
      latestBtn.hidden = !res.ok || !data.job?.id;
    } catch {
      latestBtn.hidden = true;
    }
  }

  async function submit() {
    if (!leadId || busy) return;
    busy = true;
    status.textContent = "Enviando…";
    try {
      const res = await api("/ig-skill/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(kind === "customer" ? { customerId: leadId } : { leadId }),
          model: selectedModel(),
          notes: notes.value.trim(),
          days: Number(daysSelect.value) === 90 ? 90 : 30,
        }),
      });
      const payload = (await res.json()) as { id?: string; message?: string };
      if (!res.ok || !payload.id) {
        throw new Error(payload.message || "Não iniciou a análise");
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
    if (node.closest("[data-ig-close]")) {
      close();
      return;
    }
    if (node.closest("[data-ig-latest]")) {
      close();
      opts.onOpenReport?.();
      return;
    }
    if (node.closest("[data-ig-submit]")) void submit();
  });
  modelSelect.addEventListener("change", () => {
    customWrap.hidden = modelSelect.value !== CUSTOM_VALUE;
    void refreshCost();
  });
  customInput.addEventListener("input", () => void refreshCost());

  return {
    open(id, nextKind = "lead", _lead = null) {
      leadId = id;
      kind = nextKind;
      notes.value = "";
      daysSelect.value = "30";
      status.textContent = "";
      modal.hidden = false;
      void loadModels();
      void loadLatestFlag();
    },
    close,
  };
}
