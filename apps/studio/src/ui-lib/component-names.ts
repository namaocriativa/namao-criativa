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

export function kitComponentLabel(id: string): string {
  const stored = readStored()[id];
  if (stored) return stored;
  return id.split(".")[1] ?? id;
}

export function onComponentRename(handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
