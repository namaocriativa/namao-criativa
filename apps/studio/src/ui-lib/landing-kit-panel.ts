import {
  COMPONENT_IDS,
  FAMILY_IDS,
  familyOf,
  getCatalogEntry,
  previewPageSpec,
  type ComponentId,
  type FamilyId,
} from "@namao/landing-kit";
import {
  kitComponentLabel,
  onComponentRename,
  renameComponent,
} from "./component-names";

export const FAMILY_LABELS: Record<FamilyId, string> = {
  navbar: "Navbar",
  hero: "Hero",
  "social-proof": "Social proof",
  features: "Features",
  gallery: "Galeria",
  about: "Sobre",
  testimonials: "Depoimentos",
  faq: "FAQ",
  cta: "CTA",
  contact: "Contato",
  footer: "Footer",
  content: "Conteúdo",
  layout: "Layout",
  effects: "Effects",
};

export const FAMILIES = FAMILY_IDS.filter(
  (family) =>
    family !== "testimonials" &&
    COMPONENT_IDS.some((id) => familyOf(id) === family),
);

const HIDDEN_COMPONENT_IDS = new Set<ComponentId>(["social-proof.numbers"]);

export function idsFor(family: FamilyId): ComponentId[] {
  return COMPONENT_IDS.filter(
    (id) => familyOf(id) === family && !HIDDEN_COMPONENT_IDS.has(id),
  );
}

export const OVERLAY_FAMILY = "overlays" as const;
export type NavFamily = FamilyId | typeof OVERLAY_FAMILY;

export type OverlayNavItem = {
  id: string;
  name: string;
  description: string;
};

export type LandingKitPanelOptions = {
  overlays?: OverlayNavItem[];
  renderOverlay?: (id: string, host: HTMLElement) => void;
};

function previewSrc(id: ComponentId, dark: boolean, reduced: boolean): string {
  const params = new URLSearchParams({
    id,
    dark: dark ? "1" : "0",
    reduced: reduced ? "1" : "0",
  });
  return `/kit-preview.html?${params.toString()}`;
}

export function buildLandingKitPanel(
  options: LandingKitPanelOptions = {},
): HTMLElement {
  const overlays = options.overlays ?? [];
  const panel = document.createElement("section");
  panel.className = "uilib-kit";

  const nav = document.createElement("nav");
  nav.className = "uilib-nav";
  nav.setAttribute("aria-label", "Categorias do landing-kit");

  const navTitle = document.createElement("p");
  navTitle.className = "uilib-nav-title";
  navTitle.textContent = "Categorias";
  nav.appendChild(navTitle);

  const stage = document.createElement("div");
  stage.className = "uilib-stage";

  const stageHead = document.createElement("div");
  stageHead.className = "uilib-stage-head";

  const heading = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "uilib-stage-title";
  title.textContent = "Landing Kit";
  const meta = document.createElement("p");
  meta.className = "uilib-desc";
  heading.append(title, meta);

  const toolbar = document.createElement("div");
  toolbar.className = "uilib-kit-toolbar";

  const mobileLabel = document.createElement("label");
  const mobileInput = document.createElement("input");
  mobileInput.type = "checkbox";
  mobileLabel.append(mobileInput, document.createTextNode(" mobile"));

  const darkLabel = document.createElement("label");
  const darkInput = document.createElement("input");
  darkInput.type = "checkbox";
  darkLabel.append(darkInput, document.createTextNode(" dark"));

  const reducedLabel = document.createElement("label");
  const reducedInput = document.createElement("input");
  reducedInput.type = "checkbox";
  reducedLabel.append(reducedInput, document.createTextNode(" reduced motion"));

  toolbar.append(mobileLabel, darkLabel, reducedLabel);
  stageHead.append(heading, toolbar);
  stage.appendChild(stageHead);

  const frameWrap = document.createElement("div");
  frameWrap.className = "uilib-kit-frame-wrap";
  const frame = document.createElement("iframe");
  frame.className = "uilib-kit-frame";
  frame.title = "Preview do componente";
  frameWrap.appendChild(frame);
  stage.appendChild(frameWrap);

  const specBox = document.createElement("div");
  specBox.className = "uilib-code";
  const specHead = document.createElement("div");
  specHead.className = "uilib-code-head";
  const specLabel = document.createElement("strong");
  specLabel.textContent = "Page Spec";
  specHead.appendChild(specLabel);
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "secondary uilib-copy";
  copyBtn.textContent = "Copiar";
  specHead.appendChild(copyBtn);
  const specOut = document.createElement("pre");
  specOut.className = "uilib-code-output";
  specBox.append(specHead, specOut);
  stage.appendChild(specBox);

  const overlayHost = document.createElement("div");
  overlayHost.className = "uilib-overlay-stage";
  overlayHost.hidden = true;
  stage.appendChild(overlayHost);

  type Selection =
    | { kind: "component"; id: ComponentId }
    | { kind: "overlay"; id: string };

  let selected: Selection = { kind: "component", id: "hero.cinematic" };
  let openFamily: NavFamily = "hero";
  const familyBlocks = new Map<NavFamily, HTMLElement>();
  const itemButtons = new Map<string, HTMLButtonElement>();

  function syncNav(): void {
    for (const [family, block] of familyBlocks) {
      const open = family === openFamily;
      block.classList.toggle("is-open", open);
      const toggle = block.querySelector<HTMLButtonElement>(".uilib-nav-cat");
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    for (const [id, button] of itemButtons) {
      button.classList.toggle("is-active", id === selected.id);
    }
  }

  function syncPreview(): void {
    const overlaySelected = selected.kind === "overlay";
    toolbar.hidden = overlaySelected;
    frameWrap.hidden = overlaySelected;
    specBox.hidden = overlaySelected;
    overlayHost.hidden = !overlaySelected;

    if (selected.kind === "overlay") {
      const item = overlays.find((entry) => entry.id === selected.id);
      title.textContent = item?.name || selected.id;
      meta.textContent = [item?.description || selected.id, "fixo na viewport"]
        .filter(Boolean)
        .join(" · ");
      options.renderOverlay?.(selected.id, overlayHost);
      return;
    }

    overlayHost.replaceChildren();
    const dark = darkInput.checked;
    const reduced = reducedInput.checked;
    const entry = getCatalogEntry(selected.id);
    title.textContent = kitComponentLabel(selected.id);
    meta.textContent = [
      entry?.description || selected.id,
      entry?.runtime ? `runtime ${entry.runtime}` : "",
      entry?.capabilities?.length ? entry.capabilities.join(", ") : "",
    ]
      .filter(Boolean)
      .join(" · ");
    frame.classList.toggle("is-mobile", mobileInput.checked);
    frame.src = previewSrc(selected.id, dark, reduced);
    specOut.textContent = JSON.stringify(previewPageSpec(selected.id, dark), null, 2);
  }

  function selectComponent(id: ComponentId): void {
    selected = { kind: "component", id };
    openFamily = familyOf(id);
    syncNav();
    syncPreview();
  }

  function selectOverlay(id: string): void {
    selected = { kind: "overlay", id };
    openFamily = OVERLAY_FAMILY;
    syncNav();
    syncPreview();
  }

  function refreshLabels(): void {
    for (const [id, button] of itemButtons) {
      if (button.querySelector("input")) continue;
      if (overlays.some((item) => item.id === id)) continue;
      button.textContent = kitComponentLabel(id);
    }
    if (selected.kind === "component") {
      title.textContent = kitComponentLabel(selected.id);
    }
  }

  function startRename(id: ComponentId, button: HTMLButtonElement): void {
    if (button.querySelector("input")) return;
    selectComponent(id);
    const input = document.createElement("input");
    input.className = "uilib-nav-rename";
    input.value = kitComponentLabel(id);
    input.setAttribute("aria-label", "Novo nome do componente");
    button.replaceChildren(input);
    input.focus();
    input.select();

    let closed = false;
    function close(save: boolean): void {
      if (closed) return;
      closed = true;
      const next = input.value.trim();
      if (save && next) renameComponent(id, next);
      button.textContent = kitComponentLabel(id);
    }

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        close(true);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      }
    });
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("dblclick", (event) => event.stopPropagation());
    input.addEventListener("blur", () => close(true));
  }

  onComponentRename(refreshLabels);

  for (const family of FAMILIES) {
    const ids = idsFor(family);
    const block = document.createElement("div");
    block.className = "uilib-nav-group";
    block.dataset.family = family;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "uilib-nav-cat";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", `uilib-nav-${family}`);

    const toggleLabel = document.createElement("span");
    toggleLabel.textContent = FAMILY_LABELS[family] ?? family;
    const count = document.createElement("span");
    count.className = "uilib-nav-count";
    count.textContent = String(ids.length);
    toggle.append(toggleLabel, count);

    toggle.addEventListener("click", () => {
      const first = ids[0];
      if (openFamily !== family && first) {
        selectComponent(first);
        return;
      }
      openFamily = family;
      syncNav();
    });

    const list = document.createElement("ul");
    list.className = "uilib-nav-list";
    list.id = `uilib-nav-${family}`;

    for (const id of ids) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "uilib-nav-item";
      button.textContent = kitComponentLabel(id);
      button.title = `${id} · clique duplo para renomear`;
      button.addEventListener("click", () => {
        if (button.querySelector("input")) return;
        selectComponent(id);
      });
      button.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        startRename(id, button);
      });
      itemButtons.set(id, button);
      item.appendChild(button);
      list.appendChild(item);
    }

    block.append(toggle, list);
    familyBlocks.set(family, block);
    nav.appendChild(block);
  }

  if (overlays.length) {
    const ids = overlays.map((item) => item.id);
    const block = document.createElement("div");
    block.className = "uilib-nav-group";
    block.dataset.family = OVERLAY_FAMILY;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "uilib-nav-cat";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", `uilib-nav-${OVERLAY_FAMILY}`);

    const toggleLabel = document.createElement("span");
    toggleLabel.textContent = "Overlays";
    const count = document.createElement("span");
    count.className = "uilib-nav-count";
    count.textContent = String(ids.length);
    toggle.append(toggleLabel, count);

    toggle.addEventListener("click", () => {
      const first = ids[0];
      if (openFamily !== OVERLAY_FAMILY && first) {
        selectOverlay(first);
        return;
      }
      openFamily = OVERLAY_FAMILY;
      syncNav();
    });

    const list = document.createElement("ul");
    list.className = "uilib-nav-list";
    list.id = `uilib-nav-${OVERLAY_FAMILY}`;

    for (const item of overlays) {
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "uilib-nav-item";
      button.textContent = item.name;
      button.title = item.id;
      button.addEventListener("click", () => selectOverlay(item.id));
      itemButtons.set(item.id, button);
      row.appendChild(button);
      list.appendChild(row);
    }

    block.append(toggle, list);
    familyBlocks.set(OVERLAY_FAMILY, block);
    nav.appendChild(block);
  }

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(specOut.textContent || "");
      copyBtn.textContent = "Copiado";
    } catch {
      copyBtn.textContent = "Falhou";
    }
    setTimeout(() => {
      copyBtn.textContent = "Copiar";
    }, 1600);
  });

  mobileInput.addEventListener("change", syncPreview);
  darkInput.addEventListener("change", syncPreview);
  reducedInput.addEventListener("change", syncPreview);

  panel.append(nav, stage);
  selectComponent("hero.cinematic");
  return panel;
}
