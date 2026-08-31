import {
  applyComponentName,
  getComponentMeta,
  isComponentId,
  type ComponentId,
} from "@namao/landing-kit";

const STORAGE_KEY = "uiLibComponentNames";
const EVENT = "uilib-component-rename";

type NameMap = Record<string, string>;

function readStored(): NameMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as NameMap) : {};
  } catch {
    return {};
  }
}

function writeStored(map: NameMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Sem persistência: o nome segue valendo só nesta sessão.
  }
}

export function kitComponentLabel(id: string): string {
  return getComponentMeta(id)?.name ?? id.split(".")[1] ?? id;
}

export function hydrateComponentNames(): void {
  for (const [id, name] of Object.entries(readStored())) {
    if (typeof name === "string" && name.trim()) {
      applyComponentName(id, name);
    }
  }
}

export function renameComponent(id: ComponentId, name: string): boolean {
  const next = name.trim().slice(0, 80);
  if (!next || !isComponentId(id)) return false;
  if (!applyComponentName(id, next)) return false;
  writeStored({ ...readStored(), [id]: next });
  void persistNameToCatalog(id, next);
  window.dispatchEvent(
    new CustomEvent(EVENT, { detail: { id, name: next } }),
  );
  return true;
}

export function onComponentRename(handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

async function persistNameToCatalog(id: ComponentId, name: string): Promise<void> {
  try {
    await fetch("/__kit-rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
  } catch {
    // Dev server ausente: localStorage e o catálogo em memória já foram atualizados.
  }
}

hydrateComponentNames();
