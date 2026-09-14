import { api } from "./api";

type LlmRole = "plan" | "code" | "vision" | "chat";

type RoleConfig = {
  model: string;
};

type EnvStatusItem = {
  key: string;
  group: string;
  label: string;
  required: boolean;
  present: boolean;
  ok: boolean;
  hint: string;
  value?: string;
  detail?: string;
};

type EnvStatusPayload = {
  items: EnvStatusItem[];
  counts: {
    total: number;
    ok: number;
    missingRequired: number;
    missingOptional: number;
  };
};

type LlmConfigPayload = {
  ready?: boolean;
  error?: string;
  settings?: { roles: Record<LlmRole, RoleConfig> };
  roles?: Record<LlmRole, RoleConfig & { ok?: boolean; error?: string }>;
  stages?: Array<{ id: string; label: string; role: LlmRole }>;
  defaults?: {
    gemini: Record<LlmRole, string>;
  };
  gemini?: {
    configured?: boolean;
    ok?: boolean;
    models?: string[];
    error?: string;
  };
  env?: EnvStatusPayload;
};

type ModelChoice = {
  id: string;
  tags?: string[];
  roles?: LlmRole[];
};

const ROLES: LlmRole[] = ["plan", "code", "vision", "chat"];
const CUSTOM_VALUE = "__custom__";

const GEMINI_CATALOG: ModelChoice[] = [
  {
    id: "gemini-2.5-flash",
    tags: ["recomendado", "rápido", "visão"],
  },
  {
    id: "gemini-2.5-pro",
    tags: ["qualidade"],
    roles: ["plan", "code", "chat"],
  },
  { id: "gemini-2.5-flash-lite", tags: ["barato", "rápido"] },
  { id: "gemini-2.0-flash", tags: ["estável"] },
  { id: "gemini-2.0-flash-lite", tags: ["barato"] },
  { id: "gemini-1.5-flash" },
  { id: "gemini-1.5-pro" },
];

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

function setStatus(node: HTMLElement, message: string, isError = false) {
  node.textContent = message;
  node.classList.toggle("error", isError);
}

function isRecommended(choice: ModelChoice, role: LlmRole): boolean {
  if (!choice.tags?.includes("recomendado")) return false;
  return !choice.roles || choice.roles.includes(role);
}

function tagsFor(choice: ModelChoice | undefined, role: LlmRole): string[] {
  if (!choice?.tags?.length) return [];
  if (choice.roles && !choice.roles.includes(role)) {
    return choice.tags.filter((tag) => tag !== "recomendado");
  }
  return choice.tags;
}

function findChoice(model: string): ModelChoice | undefined {
  return GEMINI_CATALOG.find((item) => item.id === model);
}

export function initConfigTab(options?: { onSaved?: () => void }) {
  const envSummary = el<HTMLElement>("config-env-summary");
  const envGrid = el<HTMLElement>("config-env-grid");
  const saveStatus = el<HTMLElement>("config-save-status");
  const saveBtn = el<HTMLButtonElement>("config-save-btn");
  const refreshBtn = el<HTMLButtonElement>("config-refresh-btn");
  const useGeminiBtn = el<HTMLButtonElement>("config-use-gemini-btn");

  let payload: LlmConfigPayload | null = null;

  function modelSelect(role: LlmRole) {
    return el<HTMLSelectElement>(`config-role-${role}-model`);
  }
  function customInput(role: LlmRole) {
    return el<HTMLInputElement>(`config-role-${role}-model-custom`);
  }
  function tagsNode(role: LlmRole) {
    return document.querySelector<HTMLElement>(`[data-tags-for="${role}"]`);
  }

  function renderTags(role: LlmRole, model: string) {
    const node = tagsNode(role);
    if (!node) return;
    const tags = tagsFor(findChoice(model), role);
    if (!tags.length || modelSelect(role).value === CUSTOM_VALUE) {
      node.hidden = true;
      node.innerHTML = "";
      return;
    }
    node.hidden = false;
    node.innerHTML = tags
      .map((tag) => {
        const best = tag === "recomendado" ? " config-model-tag--best" : "";
        return `<span class="config-model-tag${best}">${escapeAttr(tag)}</span>`;
      })
      .join("");
  }

  function syncCustomVisibility(role: LlmRole, focus = false) {
    const custom = modelSelect(role).value === CUSTOM_VALUE;
    customInput(role).hidden = !custom;
    if (custom && focus) customInput(role).focus();
  }

  function fillModelSelect(role: LlmRole, selectedModel: string) {
    const live = payload?.gemini?.models || [];
    const byId = new Map<string, ModelChoice>();
    for (const item of GEMINI_CATALOG) byId.set(item.id, item);
    for (const id of live) {
      if (!byId.has(id)) byId.set(id, { id });
    }

    const recommended: ModelChoice[] = [];
    const others: ModelChoice[] = [];
    for (const item of byId.values()) {
      if (isRecommended(item, role)) recommended.push(item);
      else others.push(item);
    }

    const current = selectedModel.trim()
      ? selectedModel
      : recommended[0]?.id || others[0]?.id || "";

    const optionHtml = (item: ModelChoice) =>
      `<option value="${escapeAttr(item.id)}">${escapeAttr(item.id)}</option>`;

    const groups: string[] = [];
    if (recommended.length) {
      groups.push(
        `<optgroup label="Recomendados">${recommended.map(optionHtml).join("")}</optgroup>`,
      );
    }
    if (others.length) {
      groups.push(
        `<optgroup label="Outros">${others.map(optionHtml).join("")}</optgroup>`,
      );
    }
    groups.push(`<option value="${CUSTOM_VALUE}">Personalizado…</option>`);

    const select = modelSelect(role);
    const known = Boolean(current) && byId.has(current);
    select.innerHTML = groups.join("");
    select.value = known ? current : CUSTOM_VALUE;
    customInput(role).value = known ? "" : current;
    syncCustomVisibility(role);
    renderTags(role, known ? current : "");
  }

  function applyRoles(roles: Record<LlmRole, RoleConfig>) {
    for (const role of ROLES) {
      const cfg = roles[role];
      if (!cfg) continue;
      fillModelSelect(role, cfg.model);
    }
  }

  function readRoles(): Record<LlmRole, RoleConfig> {
    const roles = {} as Record<LlmRole, RoleConfig>;
    for (const role of ROLES) {
      const selected = modelSelect(role).value;
      const model =
        selected === CUSTOM_VALUE
          ? customInput(role).value.trim()
          : selected.trim();
      roles[role] = { model };
    }
    return roles;
  }

  function renderStages(stages: LlmConfigPayload["stages"]) {
    for (const role of ROLES) {
      const cell = document.querySelector<HTMLElement>(
        `[data-stages-for="${role}"]`,
      );
      if (!cell) continue;
      const labels = (stages || [])
        .filter((stage) => stage.role === role)
        .map((stage) => stage.label);
      cell.textContent = labels.join(" · ") || "—";
    }
  }

  function renderEnv(data: LlmConfigPayload) {
    const env = data.env;
    if (!env?.items?.length) {
      setStatus(envSummary, "Nenhuma variável listada.", true);
      envGrid.innerHTML = "";
      return;
    }

    const parts = [`${env.counts.ok} OK`];
    if (env.counts.missingRequired) {
      parts.push(
        `${env.counts.missingRequired} obrigatória${
          env.counts.missingRequired === 1 ? "" : "s"
        } ausente${env.counts.missingRequired === 1 ? "" : "s"}`,
      );
    }
    if (env.counts.missingOptional) {
      parts.push(`${env.counts.missingOptional} opcionais vazias`);
    }
    envSummary.textContent = `${parts.join(" · ")} · ${env.counts.total} no .env`;
    envSummary.classList.toggle("error", env.counts.missingRequired > 0);

    envGrid.innerHTML = env.items
      .map((item) => envCardHtml(item, data.gemini))
      .join("");
  }

  function renderStatus(data: LlmConfigPayload) {
    renderEnv(data);
  }

  async function load() {
    try {
      const res = await api("/config/llm");
      const data = (await res.json()) as LlmConfigPayload & { message?: string };
      if (!res.ok) {
        throw new Error(data.message || "Falha ao carregar config LLM");
      }
      payload = data;
      renderStatus(data);
      renderStages(data.stages);
      if (data.settings?.roles) applyRoles(data.settings.roles);
      setStatus(saveStatus, data.ready ? "Pronto para gerar." : data.error || "");
      saveStatus.classList.toggle("error", !data.ready);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao carregar config";
      setStatus(envSummary, message, true);
      envGrid.innerHTML = "";
      setStatus(saveStatus, message, true);
    }
  }

  for (const role of ROLES) {
    modelSelect(role).addEventListener("change", () => {
      syncCustomVisibility(role, true);
      renderTags(
        role,
        modelSelect(role).value === CUSTOM_VALUE ? "" : modelSelect(role).value,
      );
    });
  }

  useGeminiBtn.addEventListener("click", () => {
    const next = {} as Record<LlmRole, RoleConfig>;
    for (const role of ROLES) {
      next[role] = {
        model: payload?.defaults?.gemini?.[role] || "gemini-2.5-flash",
      };
    }
    applyRoles(next);
  });

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    setStatus(saveStatus, "Salvando…");
    try {
      const res = await api("/config/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: readRoles() }),
      });
      const data = (await res.json()) as LlmConfigPayload & { message?: string };
      if (!res.ok) {
        throw new Error(data.message || "Falha ao salvar");
      }
      payload = data;
      renderStatus(data);
      if (data.settings?.roles) applyRoles(data.settings.roles);
      setStatus(
        saveStatus,
        data.ready
          ? "Configuração salva."
          : `Salvo, mas: ${data.error || "LLM incompleto"}`,
        !data.ready,
      );
      options?.onSaved?.();
    } catch (error) {
      setStatus(
        saveStatus,
        error instanceof Error ? error.message : "Falha ao salvar",
        true,
      );
    } finally {
      saveBtn.disabled = false;
    }
  });

  refreshBtn.addEventListener("click", () => void load());

  window.addEventListener("app:navigated", (event) => {
    const route = (event as CustomEvent<{ name?: string }>).detail;
    if (route?.name === "config") void load();
  });

  void load();
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function envCardHtml(
  item: EnvStatusItem,
  gemini?: LlmConfigPayload["gemini"],
): string {
  const geminiFailed =
    item.key === "GEMINI_API_KEY" &&
    Boolean(gemini?.configured) &&
    gemini?.ok === false;
  const tone = geminiFailed
    ? "missing"
    : item.present
      ? "ok"
      : item.required
        ? "missing"
        : "optional";
  const badge = geminiFailed ? "Falha" : item.present ? "OK" : "Ausente";
  const message = envMessage(item, gemini);
  const isError = (item.required && !item.present) || geminiFailed;
  return `<div class="config-status-card config-status-card--${tone}">
      <div class="config-env-card-head">
        <h3>${escapeAttr(item.label)} <span class="config-role-hint">${escapeAttr(item.group)}</span></h3>
        <span class="config-env-badge config-env-badge--${tone}">${badge}</span>
      </div>
      <code class="config-env-key">${escapeAttr(item.key)}</code>
      <div class="status${isError ? " error" : ""}">${escapeAttr(message)}</div>
    </div>`;
}

function envMessage(
  item: EnvStatusItem,
  gemini?: LlmConfigPayload["gemini"],
): string {
  if (item.key === "GEMINI_API_KEY" && item.present) {
    if (gemini?.ok) {
      return `OK — ${gemini.models?.length || 0} modelos listados`;
    }
    if (gemini?.configured && gemini.ok === false) {
      return `Chave presente, API falhou: ${gemini.error || "indisponível"}`;
    }
  }
  if (item.present) {
    if (item.detail && item.value) return `${item.detail} · ${item.value}`;
    if (item.detail) return item.detail;
    if (item.value) return item.value;
    return "Definida no .env";
  }
  return item.hint;
}
