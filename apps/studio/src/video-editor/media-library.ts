import { api } from "../api";
import {
  mediaKindFromMime,
  storageUrl,
  type EditDocumentStore,
  type EditMediaKind,
} from "./document";

export type LibrarySourceItem = {
  id: string;
  label: string;
  localPath: string;
  mimeType: string;
  createdAt: string;
  origin: string;
  kind: EditMediaKind;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function initMediaLibrary(opts: {
  root: HTMLElement;
  store: EditDocumentStore;
  getProjectId: () => string | null;
  onStatus: (msg: string, isError?: boolean) => void;
}) {
  const { root, store, getProjectId, onStatus } = opts;
  let items: LibrarySourceItem[] = [];
  let filter = "";
  let loading = false;

  async function load() {
    loading = true;
    render();
    try {
      const res = await api("/video-edits/library-sources");
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as { items: LibrarySourceItem[] };
      items = body.items || [];
    } catch (error) {
      onStatus(errorMessage(error, "Falha ao carregar biblioteca"), true);
      items = [];
    } finally {
      loading = false;
      render();
    }
  }

  function render() {
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.origin.toLowerCase().includes(q),
        )
      : items;

    root.innerHTML = `
      <div class="ve-library-toolbar">
        <input type="search" id="ve-library-search" placeholder="Buscar mídia…" value="${escapeHtml(filter)}" />
        <label class="ve-upload-btn outline">
          Upload
          <input type="file" id="ve-library-upload" accept="video/*,image/*,audio/*" hidden />
        </label>
        <button type="button" class="outline" id="ve-library-refresh">Atualizar</button>
      </div>
      <div class="ve-library-list">
        ${
          loading
            ? `<p class="prompt-hint">Carregando…</p>`
            : filtered.length === 0
              ? `<p class="prompt-hint">Nenhuma mídia encontrada.</p>`
              : filtered
                  .map(
                    (item) => `
            <button type="button" class="ve-library-item" data-source-id="${escapeHtml(item.id)}">
              <span class="ve-library-kind">${escapeHtml(item.kind)}</span>
              <span class="ve-library-label">${escapeHtml(item.label)}</span>
              <span class="ve-library-origin">${escapeHtml(item.origin)}</span>
            </button>`,
                  )
                  .join("")
        }
      </div>
    `;

    root.querySelector("#ve-library-search")?.addEventListener("input", (e) => {
      filter = (e.target as HTMLInputElement).value;
      render();
    });
    root.querySelector("#ve-library-refresh")?.addEventListener("click", () => {
      void load();
    });
    root.querySelector("#ve-library-upload")?.addEventListener("change", (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = "";
      if (file) void uploadLocal(file);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-source-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.sourceId;
        const item = items.find((x) => x.id === id);
        if (item) addSource(item);
      });
    });
  }

  function addSource(item: LibrarySourceItem) {
    const mediaId = store.addMediaToLibrary({
      id: item.id,
      kind: item.kind || mediaKindFromMime(item.mimeType),
      localPath: item.localPath,
      mimeType: item.mimeType,
      label: item.label,
      sourceAssetId: item.id,
      origin: item.origin,
    });
    store.addClipFromMedia(mediaId);
    onStatus(`Adicionado: ${item.label}`);
  }

  async function uploadLocal(file: File) {
    const projectId = getProjectId();
    if (!projectId) {
      onStatus("Abra um projeto para enviar arquivos", true);
      return;
    }
    onStatus("Enviando arquivo…");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api(`/video-edits/${encodeURIComponent(projectId)}/media`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload falhou");
      }
      const media = (await res.json()) as {
        id: string;
        localPath: string;
        mimeType: string;
        filename: string;
      };
      const kind = mediaKindFromMime(media.mimeType);
      const mediaId = store.addMediaToLibrary({
        kind,
        localPath: media.localPath,
        mimeType: media.mimeType,
        label: media.filename,
        origin: "upload",
        sourceAssetId: media.id,
      });
      store.addClipFromMedia(mediaId);
      onStatus(`Upload: ${media.filename}`);
      void load();
    } catch (error) {
      onStatus(errorMessage(error, "Falha no upload"), true);
    }
  }

  render();
  return {
    load,
    storageUrl,
  };
}
