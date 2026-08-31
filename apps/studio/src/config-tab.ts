type LlmProvider = "ollama" | "gemini";
type LlmRole = "plan" | "code" | "vision" | "chat";

type RoleConfig = {
  provider: LlmProvider;
  model: string;
};

type LlmConfigPayload = {
  ready?: boolean;
  error?: string;
  settings?: { roles: Record<LlmRole, RoleConfig> };
  roles?: Record<LlmRole, RoleConfig & { ok?: boolean; error?: string }>;
  stages?: Array<{ id: string; label: string; role: LlmRole }>;
  defaults?: {
    ollama: Record<LlmRole, string>;
    gemini: Record<LlmRole, string>;
  };
  gemini?: {
    configured?: boolean;
    ok?: boolean;
    models?: string[];
    error?: string;
  };
  ollama?: {
    ok?: boolean;
    url?: string;
    models?: string[];
    error?: string;
  };
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

const OLLAMA_CATALOG: ModelChoice[] = [
  {
    id: "llama3.1:8b",
    tags: ["recomendado"],
    roles: ["plan", "chat"],
  },
  {
    id: "qwen2.5-coder:7b",
    tags: ["recomendado", "código"],
    roles: ["code"],
  },
  {
    id: "llava:7b",
    tags: ["recomendado", "visão"],
    roles: ["vision"],
  },
  { id: "llama3.2:3b", tags: ["leve"] },
  { id: "qwen2.5:14b", tags: ["qualidade"] },
  { id: "mistral:7b" },
  { id: "llava:13b", tags: ["visão"], roles: ["vision"] },
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

function catalogFor(provider: LlmProvider): ModelChoice[] {
  return provider === "gemini" ? GEMINI_CATALOG : OLLAMA_CATALOG;
}

function liveModels(payload: LlmConfigPayload | null, provider: LlmProvider): string[] {
  return provider === "gemini"
    ? payload?.gemini?.models || []
    : payload?.ollama?.models || [];
}

function findChoice(
  provider: LlmProvider,
  model: string,
): ModelChoice | undefined {
  return catalogFor(provider).find((item) => item.id === model);
}

export function initConfigTab(options?: { onSaved?: () => void }) {
  const geminiStatus = el<HTMLElement>("config-gemini-status");
  const ollamaStatus = el<HTMLElement>("config-ollama-status");
  const vercelStatus = el<HTMLElement>("config-vercel-status");
  const saveStatus = el<HTMLElement>("config-save-status");
  const saveBtn = el<HTMLButtonElement>("config-save-btn");
  const refreshBtn = el<HTMLButtonElement>("config-refresh-btn");
  const useGeminiBtn = el<HTMLButtonElement>("config-use-gemini-btn");
  const useOllamaBtn = el<HTMLButtonElement>("config-use-ollama-btn");

  let payload: LlmConfigPayload | null = null;

  function providerSelect(role: LlmRole) {
    return el<HTMLSelectElement>(`config-role-${role}-provider`);
  }
  function modelSelect(role: LlmRole) {
    return el<HTMLSelectElement>(`config-role-${role}-model`);
  }
  function customInput(role: LlmRole) {
    return el<HTMLInputElement>(`config-role-${role}-model-custom`);
  }
  function tagsNode(role: LlmRole) {
    return document.querySelector<HTMLElement>(`[data-tags-for="${role}"]`);
  }

  function renderTags(role: LlmRole, provider: LlmProvider, model: string) {
    const node = tagsNode(role);
    if (!node) return;
    const tags = tagsFor(findChoice(provider, model), role);
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

  function fillModelSelect(
    role: LlmRole,
    provider: LlmProvider,
    selectedModel: string,
  ) {
    const catalog = catalogFor(provider);
    const live = liveModels(payload, provider);
    const byId = new Map<string, ModelChoice>();
    for (const item of catalog) byId.set(item.id, item);
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
        `<optgroup label="${provider === "ollama" ? "Catálogo e instalados" : "Outros"}">${others.map(optionHtml).join("")}</optgroup>`,
      );
    }
    groups.push(`<option value="${CUSTOM_VALUE}">Personalizado…</option>`);

    const select = modelSelect(role);
    const known = Boolean(current) && byId.has(current);
    select.innerHTML = groups.join("");
    select.value = known ? current : CUSTOM_VALUE;
    customInput(role).value = known ? "" : current;
    syncCustomVisibility(role);
    renderTags(role, provider, known ? current : "");
  }

  function applyRoles(roles: Record<LlmRole, RoleConfig>) {
    for (const role of ROLES) {
      const cfg = roles[role];
      if (!cfg) continue;
      providerSelect(role).value = cfg.provider;
      fillModelSelect(role, cfg.provider, cfg.model);
    }
  }

  function readRoles(): Record<LlmRole, RoleConfig> {
    const roles = {} as Record<LlmRole, RoleConfig>;
    for (const role of ROLES) {
      const provider = providerSelect(role).value as LlmProvider;
      const selected = modelSelect(role).value;
      const model =
        selected === CUSTOM_VALUE
          ? customInput(role).value.trim()
          : selected.trim();
      roles[role] = {
        provider: provider === "gemini" ? "gemini" : "ollama",
        model,
      };
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

  function renderStatus(data: LlmConfigPayload) {
    const gemini = data.gemini;
    if (!gemini?.configured) {
      setStatus(
        geminiStatus,
        "Chave ausente. Defina GEMINI_API_KEY no .env (aistudio.google.com/apikey).",
        true,
      );
    } else if (gemini.ok) {
      setStatus(
        geminiStatus,
        `OK — ${gemini.models?.length || 0} modelos listados`,
      );
    } else {
      setStatus(
        geminiStatus,
        `Chave presente, API falhou: ${gemini.error || "indisponível"}`,
        true,
      );
    }

    const ollama = data.ollama;
    if (ollama?.ok) {
      setStatus(
        ollamaStatus,
        `OK (${ollama.url}) — ${ollama.models?.length || 0} modelos locais`,
      );
    } else {
      setStatus(
        ollamaStatus,
        `Offline (${ollama?.url || "?"}): ${ollama?.error || "indisponível"}`,
        true,
      );
    }
  }

  async function loadVercel() {
    try {
      const res = await fetch("/landing/status");
      const data = (await res.json()) as {
        vercel?: { configured?: boolean; autoDeploy?: boolean; team?: boolean };
      };
      const vercel = data.vercel;
      if (!vercel?.configured) {
        setStatus(
          vercelStatus,
          "Token ausente. Defina VERCEL_TOKEN em services/platform/.env (vercel.com/account/tokens).",
          true,
        );
        return;
      }
      setStatus(
        vercelStatus,
        `OK — deploy automático ${vercel.autoDeploy ? "ligado" : "desligado"}${
          vercel.team ? " · team" : ""
        }`,
      );
    } catch (error) {
      setStatus(
        vercelStatus,
        error instanceof Error ? error.message : "Falha ao checar Vercel",
        true,
      );
    }
  }

  async function load() {
    try {
      const res = await fetch("/config/llm");
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
      void loadVercel();
    } catch (error) {
      setStatus(
        geminiStatus,
        error instanceof Error ? error.message : "Falha ao carregar config",
        true,
      );
      setStatus(ollamaStatus, "", false);
      setStatus(vercelStatus, "", false);
      setStatus(
        saveStatus,
        error instanceof Error ? error.message : "Falha ao carregar config",
        true,
      );
    }
  }

  for (const role of ROLES) {
    providerSelect(role).addEventListener("change", () => {
      const provider = providerSelect(role).value as LlmProvider;
      const fallback =
        payload?.defaults?.[provider]?.[role] ||
        (provider === "gemini" ? "gemini-2.5-flash" : "");
      fillModelSelect(role, provider, fallback);
    });
    modelSelect(role).addEventListener("change", () => {
      const provider = providerSelect(role).value as LlmProvider;
      syncCustomVisibility(role, true);
      renderTags(
        role,
        provider,
        modelSelect(role).value === CUSTOM_VALUE
          ? ""
          : modelSelect(role).value,
      );
    });
  }

  useGeminiBtn.addEventListener("click", () => {
    const next = {} as Record<LlmRole, RoleConfig>;
    for (const role of ROLES) {
      next[role] = {
        provider: "gemini",
        model: payload?.defaults?.gemini?.[role] || "gemini-2.5-flash",
      };
    }
    applyRoles(next);
  });

  useOllamaBtn.addEventListener("click", () => {
    const next = {} as Record<LlmRole, RoleConfig>;
    for (const role of ROLES) {
      next[role] = {
        provider: "ollama",
        model: payload?.defaults?.ollama?.[role] || "",
      };
    }
    applyRoles(next);
  });

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    setStatus(saveStatus, "Salvando…");
    try {
      const res = await fetch("/config/llm", {
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
