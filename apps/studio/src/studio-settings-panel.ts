import { api } from "./api";
import {
  CUSTOM_VALUE,
  modelSelectHtml,
  modelTagsHtml,
  readPickerModel,
  type LlmRole,
} from "./llm-catalog";

export type StudioSettingsTab = "run" | "llm";

type RoleConfig = { model: string };

type LlmConfigPayload = {
  ready?: boolean;
  error?: string;
  settings?: { roles: Record<LlmRole, RoleConfig> };
  defaults?: { gemini: Record<LlmRole, string> };
  gemini?: {
    configured?: boolean;
    ok?: boolean;
    models?: string[];
    error?: string;
  };
};

type LlmHost = {
  select: HTMLSelectElement;
  custom: HTMLInputElement;
  tags: HTMLElement;
  status: HTMLElement;
};

const LLM_PREFIXES = ["imagens", "videos"] as const;
const LLM_SAVED_EVENT = "app:llm-saved";

let payload: LlmConfigPayload | null = null;
let hosts: LlmHost[] = [];
let bound = false;
let applying = false;
let loaded = false;
let loading: Promise<void> | null = null;

export function initStudioSettingsPanel(panel: HTMLElement): void {
  const buttons = [
    ...panel.querySelectorAll<HTMLButtonElement>("[data-settings-tab]"),
  ];
  const panes = [
    ...panel.querySelectorAll<HTMLElement>("[data-settings-pane]"),
  ];

  function show(tab: StudioSettingsTab) {
    applySettingsTab(buttons, panes, tab);
    if (tab === "llm") void ensureStudioLlmSettings();
  }

  panel.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      "[data-settings-tab]",
    );
    if (!btn || !panel.contains(btn)) return;
    const tab = btn.dataset.settingsTab;
    if (tab === "run" || tab === "llm") show(tab);
  });

  bindStudioLlmHosts();
}

export function revealStudioRunSettings(panel: HTMLElement): void {
  const buttons = [
    ...panel.querySelectorAll<HTMLButtonElement>("[data-settings-tab]"),
  ];
  const panes = [
    ...panel.querySelectorAll<HTMLElement>("[data-settings-pane]"),
  ];
  applySettingsTab(buttons, panes, "run");
  panel.classList.add("is-open");
}

type SettingsTabButton = {
  dataset: { settingsTab?: string };
  classList: { toggle(name: string, force?: boolean): unknown };
  setAttribute(name: string, value: string): void;
};

type SettingsTabPane = {
  dataset: { settingsPane?: string };
  hidden: boolean;
};

export function applySettingsTab(
  buttons: SettingsTabButton[],
  panes: SettingsTabPane[],
  tab: StudioSettingsTab,
): void {
  for (const btn of buttons) {
    const active = btn.dataset.settingsTab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  }
  for (const pane of panes) {
    pane.hidden = pane.dataset.settingsPane !== tab;
  }
}

export async function ensureStudioLlmSettings(): Promise<void> {
  bindStudioLlmHosts();
  if (loaded) {
    applyHosts();
    return;
  }
  if (loading) {
    await loading;
    return;
  }
  loading = loadLlm()
    .catch((error) => {
      setHostsStatus(
        error instanceof Error ? error.message : "Falha ao carregar LLM",
        true,
      );
    })
    .finally(() => {
      loading = null;
    });
  await loading;
}

function bindStudioLlmHosts() {
  if (bound) return;
  bound = true;
  hosts = LLM_PREFIXES.map(queryHost).filter((host): host is LlmHost =>
    Boolean(host),
  );
  for (const host of hosts) {
    host.select.addEventListener("change", () => {
      if (applying) return;
      const custom = host.select.value === CUSTOM_VALUE;
      host.custom.hidden = !custom;
      if (custom) {
        host.custom.focus();
        renderHostTags(host, "");
        return;
      }
      void saveFrom(host);
    });
    host.custom.addEventListener("change", () => {
      if (applying) return;
      void saveFrom(host);
    });
    host.custom.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void saveFrom(host);
      }
    });
  }
}

function queryHost(prefix: (typeof LLM_PREFIXES)[number]): LlmHost | null {
  const select = document.getElementById(`${prefix}-llm-model`);
  const custom = document.getElementById(`${prefix}-llm-model-custom`);
  const tags = document.getElementById(`${prefix}-llm-tags`);
  const status = document.getElementById(`${prefix}-llm-status`);
  if (
    !(select instanceof HTMLSelectElement) ||
    !(custom instanceof HTMLInputElement) ||
    !(tags instanceof HTMLElement) ||
    !(status instanceof HTMLElement)
  ) {
    return null;
  }
  return { select, custom, tags, status };
}

async function loadLlm() {
  const res = await api("/config/llm");
  const data = (await res.json()) as LlmConfigPayload & { message?: string };
  if (!res.ok) {
    throw new Error(data.message || "Falha ao carregar config LLM");
  }
  payload = data;
  loaded = true;
  applyHosts();
  setHostsStatus(
    data.ready ? "Pronto para o chat." : data.error || "LLM incompleto",
    !data.ready,
  );
}

async function saveFrom(host: LlmHost) {
  if (!payload?.settings?.roles) {
    await loadLlm();
  }
  const model = readPickerModel(host.select.value, host.custom.value);
  if (!model) {
    setHostStatus(host, "Informe o modelo do chat.", true);
    return;
  }
  const roles = {
    plan: payload?.settings?.roles.plan || defaultRole("plan"),
    code: payload?.settings?.roles.code || defaultRole("code"),
    vision: payload?.settings?.roles.vision || defaultRole("vision"),
    chat: { model },
  };
  setHostStatus(host, "Salvando…");
  try {
    const res = await api("/config/llm", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roles }),
    });
    const data = (await res.json()) as LlmConfigPayload & { message?: string };
    if (!res.ok) {
      throw new Error(data.message || "Falha ao salvar");
    }
    payload = data;
    loaded = true;
    applyHosts();
    setHostsStatus(
      data.ready
        ? "Modelo do chat salvo."
        : `Salvo, mas: ${data.error || "LLM incompleto"}`,
      !data.ready,
    );
    window.dispatchEvent(new CustomEvent(LLM_SAVED_EVENT));
  } catch (error) {
    setHostStatus(
      host,
      error instanceof Error ? error.message : "Falha ao salvar",
      true,
    );
  }
}

function defaultRole(role: LlmRole): RoleConfig {
  return {
    model: payload?.defaults?.gemini?.[role] || "gemini-2.5-flash",
  };
}

function applyHosts() {
  applying = true;
  try {
    for (const host of hosts) applyHost(host);
  } finally {
    applying = false;
  }
}

function applyHost(host: LlmHost) {
  const model =
    payload?.settings?.roles.chat?.model ||
    payload?.defaults?.gemini?.chat ||
    "";
  const live = payload?.gemini?.models || [];
  const picker = modelSelectHtml("chat", live, model);
  host.select.innerHTML = picker.html;
  host.select.value = picker.value;
  host.custom.value = picker.custom;
  host.custom.hidden = picker.value !== CUSTOM_VALUE;
  renderHostTags(
    host,
    picker.value === CUSTOM_VALUE ? "" : picker.value,
  );
}

function renderHostTags(host: LlmHost, model: string) {
  const html = modelTagsHtml(model, "chat");
  host.tags.hidden = !html;
  host.tags.innerHTML = html;
}

function setHostsStatus(message: string, isError = false) {
  for (const host of hosts) setHostStatus(host, message, isError);
}

function setHostStatus(host: LlmHost, message: string, isError = false) {
  host.status.textContent = message;
  host.status.classList.toggle("error", isError);
}
