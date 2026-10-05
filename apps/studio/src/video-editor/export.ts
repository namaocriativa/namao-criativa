import { api } from "../api";
import type { EditDocumentStore } from "./document";
import { cancelExport, runExport } from "./ffmpeg-client";
import type { ExportPreset } from "./export-graph";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function initExportUi(opts: {
  modal: HTMLElement;
  openBtn: HTMLButtonElement;
  startBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  presetSelect: HTMLSelectElement;
  progressWrap: HTMLElement;
  barFill: HTMLElement;
  statusEl: HTMLElement;
  store: EditDocumentStore;
  onStatus: (msg: string, isError?: boolean) => void;
}) {
  const {
    modal,
    openBtn,
    startBtn,
    cancelBtn,
    presetSelect,
    progressWrap,
    barFill,
    statusEl,
    store,
    onStatus,
  } = opts;

  let exporting = false;

  function open() {
    if (!store.getState().projectId) return;
    if (store.getState().document.durationMs <= 0) {
      onStatus("Adicione clipes antes de exportar", true);
      return;
    }
    progressWrap.hidden = true;
    barFill.style.width = "0%";
    statusEl.textContent = "";
    startBtn.disabled = false;
    modal.hidden = false;
  }

  function close() {
    if (exporting) {
      cancelExport();
      exporting = false;
    }
    modal.hidden = true;
  }

  openBtn.addEventListener("click", open);
  cancelBtn.addEventListener("click", () => {
    if (exporting) {
      cancelExport();
      statusEl.textContent = "Cancelado";
      exporting = false;
      startBtn.disabled = false;
      return;
    }
    close();
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal && !exporting) close();
  });

  startBtn.addEventListener("click", () => {
    void (async () => {
      const state = store.getState();
      if (!state.projectId) return;
      exporting = true;
      startBtn.disabled = true;
      progressWrap.hidden = false;
      try {
        const preset = presetSelect.value as ExportPreset;
        const data = await runExport(state.document, preset, (p) => {
          barFill.style.width = `${Math.round(p.ratio * 100)}%`;
          statusEl.textContent = p.message;
        });
        const blob = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], {
          type: "video/mp4",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${state.name || "export"}.mp4`;
        a.click();
        URL.revokeObjectURL(url);

        const form = new FormData();
        form.append("file", blob, `${state.name || "export"}.mp4`);
        const res = await api(
          `/video-edits/${encodeURIComponent(state.projectId)}/exports`,
          { method: "POST", body: form },
        );
        if (!res.ok) {
          onStatus("Export baixado, mas falhou ao salvar no servidor", true);
        } else {
          onStatus("Exportação concluída");
        }
        close();
      } catch (error) {
        statusEl.textContent = errorMessage(error, "Falha na exportação");
        onStatus(errorMessage(error, "Falha na exportação"), true);
      } finally {
        exporting = false;
        startBtn.disabled = false;
      }
    })();
  });

  return { open, close };
}
