import { api } from "../api";
import {
  hrefFor,
  navigate,
  type AppRoute,
} from "../router";
import {
  EditDocumentStore,
  type EditDocument,
} from "./document";
import { initExportUi } from "./export";
import { initInspector } from "./inspector";
import { initMediaLibrary } from "./media-library";
import { initPreview } from "./preview";
import { initShortcuts } from "./shortcuts";
import { ensureTextFonts } from "./text-styles";
import { initTimeline } from "./timeline";

function requireEl<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ProjectListItem = {
  id: string;
  name: string;
  updatedAt: string;
  exportPath?: string | null;
};

type ProjectDetail = {
  id: string;
  name: string;
  document: EditDocument;
  media: Array<{
    id: string;
    localPath: string;
    mimeType: string;
    filename: string;
  }>;
};

export function initVideoEditorTab() {
  const home = requireEl<HTMLElement>("video-editor-home");
  const workspace = requireEl<HTMLElement>("video-editor-workspace");
  const projectList = requireEl<HTMLElement>("video-editor-project-list");
  const nameInput = requireEl<HTMLInputElement>("video-editor-name");
  const saveStatus = requireEl<HTMLElement>("video-editor-save-status");
  const backBtn = requireEl<HTMLAnchorElement>("video-editor-back");
  const newBtn = requireEl<HTMLButtonElement>("video-editor-new");
  const undoBtn = requireEl<HTMLButtonElement>("video-editor-undo");
  const redoBtn = requireEl<HTMLButtonElement>("video-editor-redo");
  const exportBtn = requireEl<HTMLButtonElement>("video-editor-export");
  const libraryRoot = requireEl<HTMLElement>("video-editor-library");
  const toolsRoot = requireEl<HTMLElement>("video-editor-tools");
  const timelineRoot = requireEl<HTMLElement>("video-editor-timeline");
  const inspectorRoot = requireEl<HTMLElement>("video-editor-inspector");
  const canvas = requireEl<HTMLCanvasElement>("video-editor-canvas");
  const probe = requireEl<HTMLVideoElement>("video-editor-video-probe");
  const playBtn = requireEl<HTMLButtonElement>("video-editor-play");
  const timecode = requireEl<HTMLElement>("video-editor-timecode");
  const root = requireEl<HTMLElement>("video-editor-root");

  const store = new EditDocumentStore();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let statusTimer: ReturnType<typeof setTimeout> | null = null;

  function setStatus(msg: string, isError = false) {
    saveStatus.textContent = msg;
    saveStatus.classList.toggle("error", isError);
    if (statusTimer) clearTimeout(statusTimer);
    if (!isError && msg) {
      statusTimer = setTimeout(() => {
        if (saveStatus.textContent === msg) saveStatus.textContent = "";
      }, 2500);
    }
  }

  const library = initMediaLibrary({
    root: libraryRoot,
    store,
    getProjectId: () => store.getState().projectId,
    onStatus: setStatus,
  });

  initTimeline({ root: timelineRoot, store });
  initInspector({ root: inspectorRoot, store });
  initPreview({
    canvas,
    probeVideo: probe,
    playBtn,
    timecodeEl: timecode,
    store,
  });
  initExportUi({
    modal: requireEl("video-editor-export-modal"),
    openBtn: exportBtn,
    startBtn: requireEl("video-editor-export-start"),
    cancelBtn: requireEl("video-editor-export-cancel"),
    presetSelect: requireEl("video-editor-export-preset"),
    progressWrap: requireEl("video-editor-export-progress"),
    barFill: requireEl("video-editor-export-bar-fill"),
    statusEl: requireEl("video-editor-export-status"),
    store,
    onStatus: setStatus,
  });
  initShortcuts(store, root);
  ensureTextFonts();

  toolsRoot.innerHTML = `
    <p class="prompt-hint">Atalhos</p>
    <ul class="ve-tools-list">
      <li><kbd>Espaço</kbd> Play / Pause</li>
      <li><kbd>S</kbd> Dividir no playhead</li>
      <li><kbd>Delete</kbd> Remover clipe</li>
      <li><kbd>⌘Z</kbd> / <kbd>⌘⇧Z</kbd> Desfazer / Refazer</li>
      <li><kbd>←</kbd> <kbd>→</kbd> Nudge playhead</li>
    </ul>
    <button type="button" class="outline" id="ve-tool-split">Dividir clipe selecionado</button>
    <button type="button" class="outline" id="ve-tool-add-text">Adicionar texto</button>
    <button type="button" class="outline" id="ve-tool-add-audio-track">Adicionar faixa de áudio</button>
  `;
  toolsRoot.querySelector("#ve-tool-split")?.addEventListener("click", () => {
    store.splitClipAtPlayhead();
  });
  toolsRoot.querySelector("#ve-tool-add-text")?.addEventListener("click", () => {
    store.addTextClip("Texto");
  });
  toolsRoot
    .querySelector("#ve-tool-add-audio-track")
    ?.addEventListener("click", () => {
      store.addTrack("audio");
    });

  root.querySelectorAll<HTMLButtonElement>("[data-ve-side]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const side = btn.dataset.veSide;
      root.querySelectorAll("[data-ve-side]").forEach((b) => {
        b.classList.toggle("active", b === btn);
      });
      libraryRoot.hidden = side !== "library";
      toolsRoot.hidden = side !== "tools";
    });
  });

  function syncChrome() {
    const s = store.getState();
    const inProject = Boolean(s.projectId);
    home.hidden = inProject;
    workspace.hidden = !inProject;
    backBtn.hidden = !inProject;
    nameInput.disabled = !inProject;
    exportBtn.disabled = !inProject;
    undoBtn.disabled = !store.canUndo();
    redoBtn.disabled = !store.canRedo();
    if (document.activeElement !== nameInput) {
      nameInput.value = s.name;
    }
    if (s.saving) setStatus("Salvando…");
    else if (s.dirty) setStatus("Alterações não salvas");
  }

  store.subscribe(() => {
    syncChrome();
    scheduleSave();
  });

  function scheduleSave() {
    const s = store.getState();
    if (!s.projectId || !s.dirty || s.saving) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void saveNow();
    }, 800);
  }

  async function saveNow() {
    const s = store.getState();
    if (!s.projectId || !s.dirty) return;
    store.setSaving(true);
    try {
      const res = await api(`/video-edits/${encodeURIComponent(s.projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: s.name, document: s.document }),
      });
      if (!res.ok) throw new Error(await res.text());
      store.setDirty(false);
      setStatus("Salvo");
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao salvar"), true);
    } finally {
      store.setSaving(false);
    }
  }

  async function loadProjectList() {
    projectList.innerHTML = `<p class="prompt-hint">Carregando…</p>`;
    try {
      const res = await api("/video-edits");
      if (!res.ok) throw new Error(await res.text());
      const items = (await res.json()) as ProjectListItem[];
      if (!items.length) {
        projectList.innerHTML = `<p class="prompt-hint">Nenhum projeto ainda. Crie o primeiro.</p>`;
        return;
      }
      projectList.innerHTML = items
        .map(
          (p) => `
        <a class="ve-project-card" href="${hrefFor({ name: "editor-project", id: p.id })}">
          <strong>${escapeHtml(p.name)}</strong>
          <span>${escapeHtml(new Date(p.updatedAt).toLocaleString("pt-BR"))}</span>
        </a>`,
        )
        .join("");
    } catch (error) {
      projectList.innerHTML = `<p class="prompt-hint error">${escapeHtml(errorMessage(error, "Falha ao listar"))}</p>`;
    }
  }

  async function openProject(id: string) {
    setStatus("Abrindo…");
    try {
      const res = await api(`/video-edits/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(await res.text());
      const project = (await res.json()) as ProjectDetail;
      store.loadProject(
        project.id,
        project.name,
        project.document || ({} as EditDocument),
      );
      void library.load();
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Não foi possível abrir o projeto"), true);
      navigate({ name: "editor" }, { replace: true });
    }
  }

  newBtn.addEventListener("click", () => {
    void (async () => {
      try {
        const res = await api("/video-edits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Novo projeto" }),
        });
        if (!res.ok) throw new Error(await res.text());
        const project = (await res.json()) as ProjectDetail;
        navigate({ name: "editor-project", id: project.id });
      } catch (error) {
        setStatus(errorMessage(error, "Falha ao criar projeto"), true);
      }
    })();
  });

  nameInput.addEventListener("change", () => {
    store.setName(nameInput.value.trim() || "Projeto sem nome");
  });
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  });

  undoBtn.addEventListener("click", () => store.undo());
  redoBtn.addEventListener("click", () => store.redo());

  window.addEventListener("beforeunload", (e) => {
    if (store.getState().dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  syncChrome();

  return {
    onRoute(route: AppRoute) {
      const isEditor =
        route.name === "editor" || route.name === "editor-project";
      document.body.classList.toggle("is-video-editor", isEditor);
      if (!isEditor) {
        store.setPlaying(false);
        return;
      }
      if (route.name === "editor") {
        store.clearProject();
        syncChrome();
        void loadProjectList();
        return;
      }
      if (route.name === "editor-project") {
        if (store.getState().projectId !== route.id) {
          void openProject(route.id);
        } else {
          syncChrome();
        }
      }
    },
  };
}
