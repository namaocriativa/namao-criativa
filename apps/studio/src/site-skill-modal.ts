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

type ObjectiveId = "leads" | "bookings" | "present" | "offers" | "campaign" | "other";

type ImageSection = "hero" | "about" | "services" | "contact";

type BriefFact = {
  key: string;
  label: string;
  value: string;
  origin: string;
  confidence: "confirmed" | "identified" | "suggested";
};

type BriefGap = { key: string; label: string; note: string };

type GalleryImage = {
  filename: string;
  src: string;
  kind: "logo" | "photo";
  recommended: boolean;
  section: ImageSection;
  selected: boolean;
};

type SiteSection = {
  id: string;
  kind: string;
  title: string;
  purpose: string;
  facts: string[];
  cta: string;
};

type StructureGap = BriefGap & { confidence?: "identified" | "suggested" };

type SiteBrief = {
  handle: string | null;
  igReady: boolean;
  analyzedAt: string | null;
  notice: string | null;
  facts: BriefFact[];
  gaps: BriefGap[];
  images: Array<Omit<GalleryImage, "selected">>;
};

const OBJECTIVES: Array<{ id: ObjectiveId; title: string; hint: string }> = [
  {
    id: "leads",
    title: "Captar novos clientes",
    hint: "Página orientada à geração de contatos e orçamentos.",
  },
  {
    id: "bookings",
    title: "Gerar agendamentos",
    hint: "Destacar serviços e incentivar marcações.",
  },
  {
    id: "present",
    title: "Apresentar o negócio",
    hint: "Transmitir profissionalismo e fortalecer a marca.",
  },
  {
    id: "offers",
    title: "Divulgar produtos ou serviços",
    hint: "Apresentar ofertas e incentivar consultas comerciais.",
  },
  {
    id: "campaign",
    title: "Promover uma campanha específica",
    hint: "Criar uma página para determinado serviço ou lançamento.",
  },
  {
    id: "other",
    title: "Outro objetivo",
    hint: "Personalizar o resultado esperado.",
  },
];

const STEPS = ["Diagnóstico", "Objetivo", "Galeria", "Estrutura"];

const CONFIDENCE_LABEL = {
  confirmed: "Confirmada",
  identified: "Identificada",
  suggested: "Sugerida",
} as const;

const SECTION_LABEL: Record<ImageSection, string> = {
  hero: "Hero",
  about: "Sobre",
  services: "Serviços",
  contact: "Contato",
};

const KIND_LABEL: Record<string, string> = {
  hero: "Hero",
  about: "Sobre",
  services: "Serviços",
  benefits: "Benefícios",
  faq: "Perguntas frequentes",
  contact: "Contato",
  custom: "Seção",
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
  let busy = false;
  let step = 0;
  let brief: SiteBrief | null = null;
  let briefError = "";
  let objective: ObjectiveId | "" = "";
  let objectiveNote = "";
  let notesText = "";
  let images: GalleryImage[] = [];
  let sections: SiteSection[] = [];
  let gaps: StructureGap[] = [];
  let proposalStamp = "";

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
        <p class="lead-share-hint">Briefing do perfil. A geração cria o repositório e não publica.</p>
        <ol class="site-skill-steps" data-skill-steps>
          ${STEPS.map(
            (label, index) => `<li>
              <button type="button" data-step="${index}">
                <span class="site-wizard__step-index">${index + 1}</span>
                <span class="site-wizard__step-label">${label}</span>
              </button>
            </li>`,
          ).join("")}
        </ol>
        <div class="site-wizard__panel" data-skill-panel></div>
        <footer class="site-skill-footer">
          <details class="site-skill-advanced">
            <summary>Configurações avançadas</summary>
            <label>Modelo de código
              <select data-skill-model></select>
            </label>
            <label data-skill-custom-wrap hidden>Modelo personalizado
              <input data-skill-custom placeholder="gemini-…" />
            </label>
            <p class="meta" data-skill-cost>Estimando custo…</p>
          </details>
          <label data-skill-files-wrap hidden>Adicionar imagens
            <input type="file" data-skill-files accept="image/*,video/*" multiple />
          </label>
          <p class="status" data-skill-status></p>
          <div class="actions">
            <button type="button" class="outline" data-skill-back hidden>Voltar</button>
            <button type="button" data-skill-next>Continuar</button>
          </div>
        </footer>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".site-skill-modal")!;
  const panel = host.querySelector<HTMLElement>("[data-skill-panel]")!;
  const modelSelect = host.querySelector<HTMLSelectElement>("[data-skill-model]")!;
  const customInput = host.querySelector<HTMLInputElement>("[data-skill-custom]")!;
  const customWrap = host.querySelector<HTMLElement>("[data-skill-custom-wrap]")!;
  const costEl = host.querySelector<HTMLElement>("[data-skill-cost]")!;
  const filesInput = host.querySelector<HTMLInputElement>("[data-skill-files]")!;
  const filesWrap = host.querySelector<HTMLElement>("[data-skill-files-wrap]")!;
  const status = host.querySelector<HTMLElement>("[data-skill-status]")!;
  const backBtn = host.querySelector<HTMLButtonElement>("[data-skill-back]")!;
  const nextBtn = host.querySelector<HTMLButtonElement>("[data-skill-next]")!;

  function close() {
    modal.hidden = true;
    busy = false;
  }

  function selectedModel() {
    return readPickerModel(modelSelect.value, customInput.value);
  }

  function setStatus(message: string, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function stamp() {
    return `${objective}\n${objectiveNote.trim()}`;
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

  function paintSteps() {
    host.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) => {
      const index = Number(button.dataset.step);
      const item = button.closest("li");
      item?.classList.toggle("is-active", index === step);
      item?.classList.toggle("is-done", index < step);
      button.disabled = index > step;
    });
    filesWrap.hidden = step !== 2;
    backBtn.hidden = step === 0;
    nextBtn.textContent =
      step === 2 ? "Propor estrutura" : step === 3 ? "Gerar site" : "Continuar";
    nextBtn.disabled = busy || (step === 0 && !brief);
  }

  function render() {
    panel.innerHTML =
      step === 0
        ? diagnosisHtml()
        : step === 1
          ? objectiveHtml()
          : step === 2
            ? galleryHtml()
            : structureHtml();
    paintSteps();
  }

  function diagnosisHtml() {
    if (briefError) {
      return `<p class="site-skill-notice">${escapeHtml(briefError)}</p>
        <button type="button" class="outline" data-skill-retry>Tentar de novo</button>`;
    }
    if (!brief) return `<p class="meta">Lendo o perfil…</p>`;
    const when = formatWhen(brief.analyzedAt);
    const head = brief.handle
      ? `<p class="site-skill-handle">@${escapeHtml(brief.handle)}</p>`
      : "";
    const notice = brief.notice
      ? `<p class="site-skill-notice">${escapeHtml(brief.notice)}</p>`
      : `<p class="meta">Análise disponível${when ? ` · ${escapeHtml(when)}` : ""}</p>`;
    const rows = brief.facts
      .map(
        (fact) => `<tr>
          <th>${escapeHtml(fact.label)}</th>
          <td>${escapeHtml(fact.value)}</td>
          <td>${escapeHtml(fact.origin)}</td>
          <td><span class="site-skill-badge site-skill-badge--${fact.confidence}">${CONFIDENCE_LABEL[fact.confidence]}</span></td>
        </tr>`,
      )
      .join("");
    const pending = brief.gaps
      .map(
        (gap) =>
          `<li><strong>${escapeHtml(gap.label)}.</strong> ${escapeHtml(gap.note)}</li>`,
      )
      .join("");
    return `${head}${notice}
      <div class="site-skill-table-wrap">
        <table class="site-skill-facts">
          <thead><tr><th>Informação</th><th>Valor</th><th>Origem</th><th>Confiança</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <h4 class="site-skill-kicker">Pendências</h4>
      <ul class="site-skill-gaps">${pending}</ul>`;
  }

  function objectiveHtml() {
    const cards = OBJECTIVES.map(
      (item) => `<button type="button" class="site-skill-goal${
        objective === item.id ? " is-selected" : ""
      }" data-objective="${item.id}" aria-pressed="${objective === item.id}">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.hint)}</span>
      </button>`,
    ).join("");
    const note =
      objective === "other"
        ? `<label>Qual resultado você espera?
            <textarea data-objective-note rows="3" maxlength="400">${escapeHtml(objectiveNote)}</textarea>
          </label>`
        : "";
    return `<h4 class="site-skill-kicker">Qual é o objetivo do site?</h4>
      <div class="site-skill-goals">${cards}</div>${note}`;
  }

  function galleryHtml() {
    const cards = images.length
      ? `<div class="site-skill-grid">${images.map((image) => imageCard(image)).join("")}</div>`
      : `<p class="meta">Nenhuma foto no perfil. Você pode adicionar imagens abaixo.</p>`;
    return `<p class="site-skill-notice">Fotos públicas do Instagram precisam de autorização de uso antes de uma publicação comercial. Esta skill não publica o site.</p>
      <p class="meta">A seleção inicial é a recomendação. Escolha a seção de cada foto.</p>
      ${cards}`;
  }

  function imageCard(image: GalleryImage) {
    const preview = image.src
      ? `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.filename)}" loading="lazy" />`
      : `<div class="site-skill-card__fallback">${escapeHtml(image.filename)}</div>`;
    const badges = [
      image.recommended ? `<span class="site-skill-badge">Recomendada</span>` : "",
      image.kind === "logo" ? `<span class="site-skill-badge">Logo</span>` : "",
    ].join("");
    const options = (Object.keys(SECTION_LABEL) as ImageSection[])
      .map(
        (section) =>
          `<option value="${section}"${section === image.section ? " selected" : ""}>${SECTION_LABEL[section]}</option>`,
      )
      .join("");
    return `<article class="site-skill-card">
      <label>
        ${preview}
        <span class="site-skill-card__meta">
          <input type="checkbox" data-image-check="${escapeHtml(image.filename)}"${image.selected ? " checked" : ""} />
          <span>${escapeHtml(image.filename)}</span>
        </span>
      </label>
      <span class="site-skill-card__badges">${badges}</span>
      <select data-image-section="${escapeHtml(image.filename)}"${image.selected ? "" : " disabled"}>${options}</select>
    </article>`;
  }

  function structureHtml() {
    if (!sections.length) return `<p class="meta">A proposta de estrutura aparece aqui.</p>`;
    const blocks = sections
      .map((section, index) => {
        const kind = KIND_LABEL[section.kind] || "Seção";
        return `<article class="site-skill-section">
          <div class="site-skill-section__bar">
            <span class="site-skill-badge">${escapeHtml(String(index + 1).padStart(2, "0"))} ${escapeHtml(kind)}</span>
            <span class="site-skill-section__actions">
              <button type="button" class="outline" data-section-up="${escapeHtml(section.id)}"${index === 0 ? " disabled" : ""}>Subir</button>
              <button type="button" class="outline" data-section-down="${escapeHtml(section.id)}"${index === sections.length - 1 ? " disabled" : ""}>Descer</button>
              <button type="button" class="outline" data-section-remove="${escapeHtml(section.id)}">Remover</button>
            </span>
          </div>
          <label>Título
            <input data-section-field="title" data-section-id="${escapeHtml(section.id)}" value="${escapeHtml(section.title)}" maxlength="80" />
          </label>
          <label>Função
            <textarea data-section-field="purpose" data-section-id="${escapeHtml(section.id)}" rows="2" maxlength="280">${escapeHtml(section.purpose)}</textarea>
          </label>
          <label>Chamada para ação
            <input data-section-field="cta" data-section-id="${escapeHtml(section.id)}" value="${escapeHtml(section.cta)}" maxlength="120" />
          </label>
        </article>`;
      })
      .join("");
    const pending = gaps
      .map((gap) => {
        const badge =
          gap.confidence === "suggested"
            ? ` <span class="site-skill-badge site-skill-badge--suggested">Sugerida</span>`
            : "";
        return `<li><strong>${escapeHtml(gap.label)}.</strong> ${escapeHtml(gap.note)}${badge}</li>`;
      })
      .join("");
    return `<h4 class="site-skill-kicker">Estrutura sugerida</h4>
      <div class="site-skill-sections">${blocks}</div>
      <button type="button" class="outline" data-section-add>Adicionar seção</button>
      <h4 class="site-skill-kicker">Pendências</h4>
      <ul class="site-skill-gaps">${pending}</ul>
      <label>Ajuste complementar
        <textarea data-skill-notes rows="3" maxlength="4000" placeholder="Tom, cores, oferta, o que evitar.">${escapeHtml(notesText)}</textarea>
      </label>`;
  }

  async function loadBrief() {
    if (!leadId) return;
    brief = null;
    briefError = "";
    setStatus("");
    render();
    const query =
      kind === "customer"
        ? `customerId=${encodeURIComponent(leadId)}`
        : `leadId=${encodeURIComponent(leadId)}`;
    try {
      const res = await api(`/site-skill/brief?${query}`);
      const payload = (await res.json()) as SiteBrief & { message?: string };
      if (!res.ok) throw new Error(payload.message || "Não leu o briefing");
      brief = payload;
      images = (payload.images || []).map((image) => ({
        ...image,
        section: image.section || "services",
        selected: Boolean(image.recommended),
      }));
    } catch (error) {
      briefError = error instanceof Error ? error.message : "Não leu o briefing";
    }
    if (!modal.hidden) render();
  }

  async function propose() {
    if (!leadId || !objective || busy) return;
    if (objective === "other" && !objectiveNote.trim()) {
      setStatus("Descreva o outro objetivo", true);
      return;
    }
    const nextStamp = stamp();
    if (nextStamp === proposalStamp && sections.length) {
      step = 3;
      setStatus("");
      render();
      return;
    }
    busy = true;
    paintSteps();
    setStatus("Propondo a estrutura…");
    const body: Record<string, string> = {
      objective,
      objectiveNote: objectiveNote.trim(),
    };
    if (kind === "customer") body.customerId = leadId;
    else body.leadId = leadId;
    try {
      const res = await api("/site-skill/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as {
        message?: string;
        sections?: SiteSection[];
        gaps?: StructureGap[];
      };
      if (!res.ok || !payload.sections?.length) {
        throw new Error(payload.message || "Não propôs a estrutura");
      }
      sections = payload.sections;
      gaps = payload.gaps || [];
      proposalStamp = nextStamp;
      step = 3;
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha", true);
    } finally {
      busy = false;
      render();
    }
  }

  async function submit() {
    if (!leadId || busy) return;
    if (!objective) {
      setStatus("Escolha o objetivo da página", true);
      return;
    }
    if (objective === "other" && !objectiveNote.trim()) {
      setStatus("Descreva o outro objetivo", true);
      return;
    }
    const ready = sections.filter((section) => section.title.trim() && section.purpose.trim());
    if (!ready.length) {
      setStatus("Mantenha ao menos uma seção", true);
      return;
    }
    busy = true;
    paintSteps();
    setStatus("Enviando…");
    const selected = images.filter((image) => image.selected);
    const approved = {
      objective,
      objectiveNote: objectiveNote.trim(),
      sections: ready,
      gaps,
      images: selected.map((image) => ({
        filename: image.filename,
        section: image.section,
        kind: image.kind,
      })),
      notes: notesText.trim(),
    };
    const data = new FormData();
    if (kind === "customer") data.set("customerId", leadId);
    else data.set("leadId", leadId);
    data.set("model", selectedModel());
    data.set("notes", notesText.trim());
    data.set("brief", JSON.stringify(approved));
    if (selected.length) data.set("imageIds", selected.map((image) => image.filename).join(","));
    for (const file of filesInput.files || []) data.append("files", file);
    try {
      const res = await api("/site-skill/generate", { method: "POST", body: data });
      const payload = (await res.json()) as { id?: string; message?: string };
      if (!res.ok || !payload.id) throw new Error(payload.message || "Não iniciou a skill");
      close();
      opts.onStarted(payload.id);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Falha", true);
      busy = false;
      paintSteps();
    }
  }

  function goNext() {
    if (busy) return;
    if (step === 0) {
      if (!brief) return;
      step = 1;
      setStatus("");
      render();
      return;
    }
    if (step === 1) {
      if (!objective) {
        setStatus("Escolha o objetivo da página", true);
        return;
      }
      if (objective === "other" && !objectiveNote.trim()) {
        setStatus("Descreva o outro objetivo", true);
        return;
      }
      step = 2;
      setStatus("");
      render();
      return;
    }
    if (step === 2) {
      void propose();
      return;
    }
    void submit();
  }

  function findImage(filename: string) {
    return images.find((image) => image.filename === filename);
  }

  function findSection(id: string) {
    return sections.find((section) => section.id === id);
  }

  host.addEventListener("click", (event) => {
    const node = event.target as HTMLElement;
    if (node.closest("[data-skill-close]")) {
      close();
      return;
    }
    if (node.closest("[data-skill-retry]")) {
      void loadBrief();
      return;
    }
    if (node.closest("[data-skill-back]")) {
      if (step > 0) {
        step -= 1;
        setStatus("");
        render();
      }
      return;
    }
    if (node.closest("[data-skill-next]")) {
      goNext();
      return;
    }
    const stepButton = node.closest<HTMLButtonElement>("[data-step]");
    if (stepButton && !stepButton.disabled) {
      step = Number(stepButton.dataset.step);
      setStatus("");
      render();
      return;
    }
    const goal = node.closest<HTMLButtonElement>("[data-objective]");
    if (goal?.dataset.objective) {
      objective = goal.dataset.objective as ObjectiveId;
      setStatus("");
      render();
      return;
    }
    const remove = node.closest<HTMLButtonElement>("[data-section-remove]");
    if (remove?.dataset.sectionRemove) {
      if (sections.length < 2) {
        setStatus("Mantenha ao menos uma seção", true);
        return;
      }
      sections = sections.filter((section) => section.id !== remove.dataset.sectionRemove);
      render();
      return;
    }
    const up = node.closest<HTMLButtonElement>("[data-section-up]");
    if (up?.dataset.sectionUp) {
      moveSection(up.dataset.sectionUp, -1);
      return;
    }
    const down = node.closest<HTMLButtonElement>("[data-section-down]");
    if (down?.dataset.sectionDown) {
      moveSection(down.dataset.sectionDown, 1);
      return;
    }
    if (node.closest("[data-section-add]")) {
      sections.push({
        id: `custom-${Date.now()}`,
        kind: "custom",
        title: "Nova seção",
        purpose: "Descreva o papel desta seção.",
        facts: [],
        cta: "",
      });
      render();
    }
  });

  host.addEventListener("change", (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.dataset.imageCheck) {
      const image = findImage(target.dataset.imageCheck);
      if (!image) return;
      image.selected = target.checked;
      const select = host.querySelector<HTMLSelectElement>(
        `[data-image-section="${CSS.escape(image.filename)}"]`,
      );
      if (select) select.disabled = !image.selected;
      return;
    }
    if (target instanceof HTMLSelectElement && target.dataset.imageSection) {
      const image = findImage(target.dataset.imageSection);
      if (image) image.section = target.value as ImageSection;
    }
  });

  host.addEventListener("input", (event) => {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLTextAreaElement && target.matches("[data-objective-note]")) {
      objectiveNote = target.value;
      return;
    }
    if (target instanceof HTMLTextAreaElement && target.matches("[data-skill-notes]")) {
      notesText = target.value;
      return;
    }
    if (
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      target.dataset.sectionId &&
      target.dataset.sectionField
    ) {
      const section = findSection(target.dataset.sectionId);
      const field = target.dataset.sectionField;
      if (!section || (field !== "title" && field !== "purpose" && field !== "cta")) return;
      section[field] = target.value;
    }
  });

  function moveSection(id: string, delta: number) {
    const index = sections.findIndex((section) => section.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= sections.length) return;
    const [item] = sections.splice(index, 1);
    sections.splice(next, 0, item);
    render();
  }

  modelSelect.addEventListener("change", () => {
    customWrap.hidden = modelSelect.value !== CUSTOM_VALUE;
    void refreshCost();
  });
  customInput.addEventListener("input", () => void refreshCost());

  return {
    open(id, nextKind = "lead") {
      leadId = id;
      kind = nextKind;
      busy = false;
      step = 0;
      brief = null;
      briefError = "";
      objective = "";
      objectiveNote = "";
      notesText = "";
      images = [];
      sections = [];
      gaps = [];
      proposalStamp = "";
      filesInput.value = "";
      setStatus("");
      modal.hidden = false;
      render();
      void loadModels();
      void loadBrief();
    },
    close,
  };
}

function formatWhen(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
