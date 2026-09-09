// Importa pelo barrel para garantir que os componentes estejam registrados.
import {
  buildManifest,
  defaultProps,
  getComponent,
  listComponents,
  resolveProps,
} from "./index";
import { buildLandingKitPanel } from "./landing-kit-panel";
import type {
  ComponentProps,
  PropSchema,
  UiComponentDefinition,
  UiComponentInstance,
} from "./types";

const STORAGE_KEY = "uiLibState";

type ComponentState = { active: boolean; props: ComponentProps };
type PlaygroundState = Record<string, ComponentState>;

type CodeTab = "spec" | "html" | "css" | "js";

const CODE_TABS: Array<{ id: CodeTab; label: string }> = [
  { id: "spec", label: "Spec (Gemini)" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "js", label: "JS" },
];

function loadState(): PlaygroundState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as PlaygroundState) : {};
  } catch {
    return {};
  }
}

function saveState(state: PlaygroundState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sem persistência disponível: o playground segue funcionando em memória.
  }
}

function stateFor(
  state: PlaygroundState,
  definition: UiComponentDefinition,
): ComponentState {
  const stored = state[definition.id];
  return {
    active: stored ? stored.active !== false : true,
    props: resolveProps(definition, stored?.props),
  };
}

function control(
  name: string,
  schema: PropSchema,
  value: ComponentProps[string],
  onChange: (next: string | number | boolean) => void,
): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "uilib-control";

  const label = document.createElement("span");
  label.className = "uilib-control-label";
  label.textContent = schema.label;
  wrapper.appendChild(label);

  if (schema.kind === "select") {
    const select = document.createElement("select");
    for (const option of schema.options) {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.label;
      select.appendChild(node);
    }
    select.value = String(value);
    select.addEventListener("change", () => onChange(select.value));
    wrapper.appendChild(select);
  } else if (schema.kind === "boolean") {
    wrapper.classList.add("uilib-control-inline");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(value);
    input.addEventListener("change", () => onChange(input.checked));
    wrapper.insertBefore(input, label);
  } else if (schema.kind === "number") {
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(schema.min);
    input.max = String(schema.max);
    input.step = String(schema.step);
    input.value = String(value);
    input.addEventListener("input", () => onChange(Number(input.value)));
    wrapper.appendChild(input);
  } else if (schema.kind === "color") {
    const input = document.createElement("input");
    input.type = "color";
    input.className = "uilib-color";
    input.value = String(value);
    input.addEventListener("input", () => onChange(input.value));
    wrapper.appendChild(input);
  } else {
    const input = document.createElement("input");
    input.type = "text";
    input.value = String(value);
    if (schema.placeholder) input.placeholder = schema.placeholder;
    input.addEventListener("input", () => onChange(input.value));
    wrapper.appendChild(input);
  }

  const hint = document.createElement("span");
  hint.className = "uilib-control-hint";
  hint.textContent = schema.description;
  wrapper.appendChild(hint);

  const propName = document.createElement("code");
  propName.className = "uilib-control-prop";
  propName.textContent = name;
  label.appendChild(propName);

  return wrapper;
}

function copyButton(getText: () => string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary uilib-copy";
  button.textContent = "Copiar";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getText());
      button.textContent = "Copiado";
    } catch {
      button.textContent = "Falhou";
    }
    setTimeout(() => {
      button.textContent = "Copiar";
    }, 1600);
  });
  return button;
}

function buildCard(
  definition: UiComponentDefinition,
  state: PlaygroundState,
  mounted: Map<string, UiComponentInstance>,
): HTMLElement {
  const current = stateFor(state, definition);
  state[definition.id] = current;

  const card = document.createElement("article");
  card.className = "uilib-card";

  const head = document.createElement("header");
  head.className = "uilib-card-head";

  const heading = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = definition.name;
  const id = document.createElement("code");
  id.className = "uilib-id";
  id.textContent = definition.id;
  title.appendChild(id);
  heading.appendChild(title);

  const description = document.createElement("p");
  description.className = "uilib-desc";
  description.textContent = definition.description;
  heading.appendChild(description);

  const tags = document.createElement("div");
  tags.className = "uilib-tags";
  for (const tag of definition.tags) {
    const chip = document.createElement("span");
    chip.className = "lead-tag";
    chip.textContent = tag;
    tags.appendChild(chip);
  }
  heading.appendChild(tags);
  head.appendChild(heading);

  const toggle = document.createElement("label");
  toggle.className = "uilib-toggle";
  const toggleInput = document.createElement("input");
  toggleInput.type = "checkbox";
  toggleInput.checked = current.active;
  toggle.appendChild(toggleInput);
  toggle.appendChild(document.createTextNode("Ativo na página"));
  head.appendChild(toggle);
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "uilib-card-body";

  const controls = document.createElement("div");
  controls.className = "uilib-controls";
  body.appendChild(controls);

  const preview = document.createElement("div");
  preview.className = "uilib-preview";
  const previewTrack = document.createElement("div");
  previewTrack.className = "uilib-preview-track";
  const previewBar = document.createElement("span");
  previewTrack.appendChild(previewBar);
  const previewNote = document.createElement("p");
  previewNote.className = "uilib-preview-note";
  previewNote.textContent =
    definition.placement === "overlay"
      ? "Componente overlay: role a página para ver a barra real na viewport. Abaixo, uma amostra estática das cores e altura."
      : "Pré-visualização do componente.";
  preview.appendChild(previewNote);
  preview.appendChild(previewTrack);
  body.appendChild(preview);
  card.appendChild(body);

  const codeBox = document.createElement("div");
  codeBox.className = "uilib-code";

  const codeHead = document.createElement("div");
  codeHead.className = "uilib-code-head";
  const codeTabs = document.createElement("div");
  codeTabs.className = "uilib-code-tabs";
  codeHead.appendChild(codeTabs);

  const output = document.createElement("pre");
  output.className = "uilib-code-output";

  codeHead.appendChild(copyButton(() => output.textContent || ""));
  codeBox.appendChild(codeHead);
  codeBox.appendChild(output);
  card.appendChild(codeBox);

  const actions = document.createElement("div");
  actions.className = "actions uilib-card-actions";
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "outline";
  resetBtn.textContent = "Restaurar padrões";
  actions.appendChild(resetBtn);
  card.appendChild(actions);

  let activeTab: CodeTab = "spec";

  function codeFor(tab: CodeTab): string {
    if (tab === "spec") {
      return JSON.stringify(
        { component: definition.id, props: current.props },
        null,
        2,
      );
    }
    const code = definition.toStaticCode(current.props);
    return code[tab];
  }

  function renderCode(): void {
    output.textContent = codeFor(activeTab);
    codeTabs.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button.dataset.codeTab === activeTab);
    });
  }

  for (const tab of CODE_TABS) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.codeTab = tab.id;
    button.textContent = tab.label;
    button.addEventListener("click", () => {
      activeTab = tab.id;
      renderCode();
    });
    codeTabs.appendChild(button);
  }

  function renderPreview(): void {
    const code = definition.toStaticCode(current.props);
    const styleMatch = /style="([^"]*)"/.exec(code.html);
    previewTrack.setAttribute("style", styleMatch ? styleMatch[1] : "");
  }

  function sync(): void {
    const instance = mounted.get(definition.id);
    if (current.active) {
      if (instance) {
        instance.update(current.props);
      } else {
        mounted.set(definition.id, definition.mount(current.props));
      }
    } else if (instance) {
      instance.destroy();
      mounted.delete(definition.id);
    }
    renderPreview();
    renderCode();
    saveState(state);
  }

  function renderControls(): void {
    controls.replaceChildren();
    for (const [name, schema] of Object.entries(definition.props)) {
      controls.appendChild(
        control(name, schema, current.props[name], (value) => {
          current.props = resolveProps(definition, { ...current.props, [name]: value });
          sync();
        }),
      );
    }
  }

  toggleInput.addEventListener("change", () => {
    current.active = toggleInput.checked;
    sync();
  });

  resetBtn.addEventListener("click", () => {
    current.props = defaultProps(definition);
    renderControls();
    sync();
  });

  renderControls();
  sync();
  return card;
}

function buildManifestPanel(): HTMLElement {
  const panel = document.createElement("details");
  panel.className = "lead-data-fold uilib-manifest";

  const summary = document.createElement("summary");
  summary.textContent = "Manifesto para o Gemini (JSON)";
  panel.appendChild(summary);

  const bodyEl = document.createElement("div");
  bodyEl.className = "lead-data-body";

  const hint = document.createElement("p");
  hint.className = "prompt-hint";
  hint.textContent =
    "Catálogo legível por máquina com todos os componentes e suas props customizáveis. É este JSON que se injeta no prompt para o Gemini escolher e configurar componentes da página.";
  bodyEl.appendChild(hint);

  const output = document.createElement("pre");
  output.className = "uilib-code-output";
  output.textContent = JSON.stringify(buildManifest(), null, 2);

  const actions = document.createElement("div");
  actions.className = "actions";
  actions.appendChild(copyButton(() => output.textContent || ""));

  bodyEl.appendChild(actions);
  bodyEl.appendChild(output);
  panel.appendChild(bodyEl);
  return panel;
}

/**
 * Monta a galeria da UI Lib e ativa os componentes marcados como ativos.
 * Overlays entram como categoria no mesmo palco do landing-kit.
 * Os overlays ativos vivem na página inteira, não só na aba.
 */
export function initUiLib(root: HTMLElement): void {
  const state = loadState();
  const mounted = new Map<string, UiComponentInstance>();
  const overlayCards = new Map<string, HTMLElement>();

  for (const definition of listComponents()) {
    overlayCards.set(definition.id, buildCard(definition, state, mounted));
  }

  root.replaceChildren();
  root.appendChild(
    buildLandingKitPanel({
      overlays: listComponents().map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
      })),
      renderOverlay(id, host) {
        const card = overlayCards.get(id);
        if (card) {
          host.replaceChildren(card);
          return;
        }
        const definition = getComponent(id);
        if (!definition) return;
        const next = buildCard(definition, state, mounted);
        overlayCards.set(id, next);
        host.replaceChildren(next);
      },
    }),
  );
  root.appendChild(buildManifestPanel());
  saveState(state);
}
