import type { EditDocumentStore } from "./document";

export function initShortcuts(store: EditDocumentStore, root: HTMLElement) {
  function onKey(e: KeyboardEvent) {
    if (!root.closest(".tab-panel.active")) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      const s = store.getState();
      store.setPlaying(!s.playing);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      const { selection } = store.getState();
      if (selection.trackId && selection.clipId) {
        e.preventDefault();
        store.removeClip(selection.trackId, selection.clipId);
      }
      return;
    }
    if (e.key.toLowerCase() === "s" && !meta) {
      e.preventDefault();
      store.splitClipAtPlayhead();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      store.setPlayhead(store.getState().playheadMs - (e.shiftKey ? 1000 : 100));
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      store.setPlayhead(store.getState().playheadMs + (e.shiftKey ? 1000 : 100));
    }
  }

  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
