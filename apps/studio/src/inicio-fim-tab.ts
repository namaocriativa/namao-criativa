import { api } from "./api";
import { INICIO_FIM_ID } from "./creative/features";
import { navigate, titleForRoute, type AppRoute } from "./router";
import type { CreativeStartEndClip, ImageLibraryProject } from "./types";
import {
  appendVideoRunSettings,
  readVideoRunSettings,
  subscribeVideoRunSettings,
  videoRunSettingsPayload,
} from "./video-run-settings";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type FrameSlot = "first" | "last";

type FrameSelection = {
  file?: File;
  imageAssetId?: string;
  previewSrc: string;
  objectUrl?: string;
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

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // ignore
  }
  return fallback;
}

function requireEl<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

function assetSrc(path: string | undefined): string {
  if (!path) return "";
  return `/${path.replace(/^\/+/, "")}`;
}

function statusLabel(status: string): string {
  if (status === "ready") return "Pronto";
  if (status === "generating") return "Gerando";
  if (status === "failed") return "Falhou";
  return "Rascunho";
}

function isLockedGenerating(clip: { status: string; updatedAt?: string } | null): boolean {
  if (clip?.status !== "generating") return false;
  const at = clip.updatedAt ? Date.parse(clip.updatedAt) : NaN;
  if (!Number.isFinite(at)) return true;
  return Date.now() - at < 12 * 60 * 1000;
}

function frameIsFresh(frame: FrameSelection | null): boolean {
  return Boolean(frame?.file || frame?.imageAssetId);
}

function isImageFile(file: File | undefined): file is File {
  return Boolean(file && file.type.startsWith("image/"));
}

export function initInicioFimTab(): {
  onRoute: (route: AppRoute) => void;
} {
  const composerEl = requireEl<HTMLElement>("videos-skill-form");
  const statusEl = requireEl<HTMLElement>("videos-skill-status");
  const nameInput = requireEl<HTMLInputElement>("videos-project-name");

  let clips: CreativeStartEndClip[] = [];
  let current: CreativeStartEndClip | null = null;
  let firstFrame: FrameSelection | null = null;
  let lastFrame: FrameSelection | null = null;
  let prompt = "";
  let busy = false;
  let active = false;
  let pickerSlot: FrameSlot = "first";
  let routeSeq = 0;
  let pollTimer = 0;
  let unsubscribeRun: (() => void) | null = null;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function revokeFrame(frame: FrameSelection | null) {
    if (frame?.objectUrl) URL.revokeObjectURL(frame.objectUrl);
  }

  function setFrame(slot: FrameSlot, next: FrameSelection | null) {
    if (slot === "first") {
      revokeFrame(firstFrame);
      firstFrame = next;
    } else {
      revokeFrame(lastFrame);
      lastFrame = next;
    }
  }

  function frameFromFile(file: File): FrameSelection {
    const objectUrl = URL.createObjectURL(file);
    return { file, previewSrc: objectUrl, objectUrl };
  }

  function applyFiles(slot: FrameSlot, files: FileList | File[] | null) {
    const file = Array.from(files || []).find(isImageFile);
    if (!file) {
      setStatus("Envie uma imagem JPEG, PNG, WebP ou GIF", true);
      return;
    }
    setFrame(slot, frameFromFile(file));
    render();
    setStatus("");
  }

  function dropzoneMarkup(slot: FrameSlot, frame: FrameSelection | null): string {
    const label = slot === "first" ? "Início" : "Fim";
    const hint = slot === "first" ? "Quadro inicial" : "Quadro final";
    return `<div class="inicio-fim-drop${frame ? " has-frame" : ""}" data-drop-slot="${slot}" tabindex="0">
      ${
        frame
          ? `<img src="${escapeHtml(frame.previewSrc)}" alt="${escapeHtml(hint)}" />`
          : `<span class="inicio-fim-drop-empty">${escapeHtml(hint)}</span>`
      }
      <em>${escapeHtml(label)}</em>
      <div class="inicio-fim-drop-actions">
        <label class="inicio-fim-upload">
          <input type="file" accept="${IMAGE_ACCEPT}" data-frame-input="${slot}" />
          Enviar
        </label>
        <button type="button" class="videos-text-btn" data-pick-library="${slot}">Library</button>
        ${
          frame
            ? `<button type="button" class="videos-text-btn" data-clear-frame="${slot}">Limpar</button>`
            : ""
        }
      </div>
    </div>`;
  }

  function resultMarkup(): string {
    if (busy || current?.status === "generating") {
      return `<div class="inicio-fim-result is-busy">
        <p>Gerando o clipe…</p>
      </div>`;
    }
    if (current?.status === "failed") {
      return `<div class="inicio-fim-result is-failed">
        <p>${escapeHtml(current.error || "Falha ao gerar o clipe")}</p>
      </div>`;
    }
    if (current?.status === "ready" && current.localPath) {
      return `<div class="inicio-fim-result is-ready">
        <video src="${escapeHtml(assetSrc(current.localPath))}" controls playsinline></video>
      </div>`;
    }
    return `<div class="inicio-fim-result is-idle">
      <p>O vídeo aparece aqui, interpolando o início até o fim.</p>
    </div>`;
  }

  function historyMarkup(): string {
    if (!clips.length) {
      return `<p class="criativo-empty">Nenhum clipe ainda. Solte os dois quadros e gere o primeiro.</p>`;
    }
    return `<div class="inicio-fim-history">
      ${clips
        .map((clip) => {
          const src = clip.status === "ready" ? assetSrc(clip.localPath) : "";
          const first = assetSrc(clip.firstFramePath);
          const activeClip = current?.id === clip.id ? " is-active" : "";
          const portrait = clip.aspectRatio === "9:16" ? " inicio-fim-history-card--portrait" : "";
          return `<a class="inicio-fim-history-card${activeClip}${portrait}" data-clip-id="${escapeHtml(clip.id)}" href="${escapeHtml(
            `/criativo/habilidade/${INICIO_FIM_ID}/${encodeURIComponent(clip.id)}`,
          )}">
            ${
              src
                ? `<video src="${escapeHtml(src)}" muted playsinline preload="metadata"></video>`
                : first
                  ? `<img src="${escapeHtml(first)}" alt="" />`
                  : `<span class="inicio-fim-history-empty">${escapeHtml(statusLabel(clip.status))}</span>`
            }
            <strong>${escapeHtml(clip.duration)} · ${escapeHtml(clip.aspectRatio)}</strong>
            <em>${escapeHtml(statusLabel(clip.status))}</em>
          </a>`;
        })
        .join("")}
    </div>`;
  }

  function render() {
    nameInput.value = "Início e fim";
    const firstFresh = frameIsFresh(firstFrame);
    const lastFresh = frameIsFresh(lastFrame);
    const locked = isLockedGenerating(current);
    const showGenerate = !current || current.status !== "ready" || firstFresh || lastFresh;
    const canGenerate = Boolean(showGenerate && firstFrame && lastFrame && !busy && !locked);
    const aspectRatio = readVideoRunSettings().aspectRatio;
    composerEl.innerHTML = `
      <div class="inicio-fim-workspace">
        <div class="criativo-composer-copy">
          <p class="criativo-kicker">Início e fim</p>
          <h3>Do primeiro quadro ao último, no tempo que você escolher</h3>
        </div>
        <div class="inicio-fim-stage inicio-fim-stage--${aspectRatio === "9:16" ? "portrait" : "landscape"}">
          ${dropzoneMarkup("first", firstFrame)}
          <div class="inicio-fim-bridge">
            ${resultMarkup()}
          </div>
          ${dropzoneMarkup("last", lastFrame)}
        </div>
        <form id="inicio-fim-form" class="inicio-fim-composer">
          <label class="inicio-fim-prompt">
            Movimento
            <textarea id="inicio-fim-prompt" rows="3" maxlength="8000" placeholder="Opcional. Descreva a câmera, a luz e o que acontece entre os dois quadros.">${escapeHtml(prompt)}</textarea>
          </label>
          <div class="inicio-fim-toolbar">
            ${
              showGenerate
                ? `<button type="submit" id="inicio-fim-generate" ${canGenerate ? "" : "disabled"}>Gerar vídeo</button>`
                : ""
            }
            ${
              current?.id
                ? `<button type="button" id="inicio-fim-new">Novo</button>`
                : ""
            }
            ${
              current?.status === "ready" && current.localPath
                ? `<a class="videos-text-btn" href="${escapeHtml(assetSrc(current.localPath))}" download="${escapeHtml(current.filename || "clipe.mp4")}">Baixar</a>`
                : ""
            }
            ${
              current?.id && !locked
                ? `<button type="button" class="danger" id="inicio-fim-delete">Excluir</button>`
                : ""
            }
          </div>
        </form>
        <section class="inicio-fim-strip">
          <h4>Histórico</h4>
          ${historyMarkup()}
        </section>
        <div id="inicio-fim-picker" class="videos-picker" hidden>
          <div class="videos-picker-dialog" role="dialog" aria-labelledby="inicio-fim-picker-title">
            <header>
              <h3 id="inicio-fim-picker-title">Usar imagem do studio</h3>
              <button type="button" id="inicio-fim-picker-close">Fechar</button>
            </header>
            <p class="status" id="inicio-fim-picker-status"></p>
            <div id="inicio-fim-picker-list"></div>
          </div>
        </div>
      </div>
    `;
    bind();
  }

  function bind() {
    composerEl.querySelectorAll<HTMLInputElement>("[data-frame-input]").forEach((input) => {
      input.addEventListener("change", () => {
        const slot = input.dataset.frameInput as FrameSlot;
        applyFiles(slot, input.files);
        input.value = "";
      });
    });
    composerEl.querySelectorAll<HTMLButtonElement>("[data-pick-library]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slot = btn.dataset.pickLibrary as FrameSlot;
        void openPicker(slot);
      });
    });
    composerEl.querySelectorAll<HTMLButtonElement>("[data-clear-frame]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slot = btn.dataset.clearFrame as FrameSlot;
        setFrame(slot, null);
        render();
      });
    });
    composerEl.querySelectorAll<HTMLElement>("[data-drop-slot]").forEach((zone) => {
      const slot = zone.dataset.dropSlot as FrameSlot;
      zone.addEventListener("dragover", (event) => {
        event.preventDefault();
        zone.classList.add("is-over");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
      zone.addEventListener("drop", (event) => {
        event.preventDefault();
        zone.classList.remove("is-over");
        applyFiles(slot, event.dataTransfer?.files || null);
      });
    });
    const form = composerEl.querySelector("#inicio-fim-form") as HTMLFormElement | null;
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      void generate();
    });
    const promptEl = composerEl.querySelector("#inicio-fim-prompt") as HTMLTextAreaElement | null;
    promptEl?.addEventListener("input", () => {
      prompt = promptEl.value;
    });
    composerEl.querySelector("#inicio-fim-new")?.addEventListener("click", () => {
      resetCanvas();
      navigate({ name: "criativo-skill", id: INICIO_FIM_ID });
      render();
    });
    composerEl.querySelector("#inicio-fim-delete")?.addEventListener("click", () => {
      void deleteCurrent();
    });
    composerEl.querySelectorAll<HTMLAnchorElement>("[data-clip-id]").forEach((card) => {
      card.addEventListener("click", (event) => {
        event.preventDefault();
        const id = card.dataset.clipId;
        if (!id) return;
        const clip = clips.find((item) => item.id === id);
        if (clip) showClip(clip);
        navigate({ name: "criativo-skill", id: INICIO_FIM_ID, clipId: id });
      });
    });
    composerEl.querySelector("#inicio-fim-picker-close")?.addEventListener("click", closePicker);
    composerEl.querySelector("#inicio-fim-picker")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closePicker();
    });
    composerEl.querySelector("#inicio-fim-picker-list")?.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement | null)?.closest("[data-image-asset]") as
        | HTMLElement
        | null;
      if (!btn?.dataset.imageAsset) return;
      setFrame(pickerSlot, {
        imageAssetId: btn.dataset.imageAsset,
        previewSrc: btn.dataset.imageSrc || "",
      });
      closePicker();
      render();
    });
  }

  function closePicker() {
    const picker = composerEl.querySelector("#inicio-fim-picker") as HTMLElement | null;
    if (picker) picker.hidden = true;
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    closePicker();
  }

  function stopPoll() {
    if (pollTimer) {
      window.clearTimeout(pollTimer);
      pollTimer = 0;
    }
  }

  function schedulePoll() {
    stopPoll();
    if (!active || busy || current?.status !== "generating" || !current.id) return;
    const id = current.id;
    pollTimer = window.setTimeout(() => {
      void refreshGenerating(id);
    }, 2500);
  }

  async function refreshGenerating(id: string) {
    if (!active || busy) return;
    try {
      const res = await api(`/creative/inicio-fim/${encodeURIComponent(id)}`);
      if (!res.ok) {
        schedulePoll();
        return;
      }
      const clip = (await res.json()) as CreativeStartEndClip;
      clips = [clip, ...clips.filter((item) => item.id !== clip.id)];
      if (current?.id !== id) return;
      if (clip.status !== current.status || clip.localPath !== current.localPath) {
        showClip(clip);
      } else {
        schedulePoll();
      }
    } catch {
      schedulePoll();
    }
  }

  async function openPicker(slot: FrameSlot) {
    pickerSlot = slot;
    const picker = composerEl.querySelector("#inicio-fim-picker") as HTMLElement | null;
    const pickerStatus = composerEl.querySelector("#inicio-fim-picker-status") as HTMLElement | null;
    const pickerList = composerEl.querySelector("#inicio-fim-picker-list") as HTMLElement | null;
    if (!picker || !pickerStatus || !pickerList) return;
    picker.hidden = false;
    pickerStatus.textContent = "Carregando imagens…";
    pickerList.innerHTML = "";
    try {
      const res = await api("/image-projects/library");
      if (!res.ok) throw new Error(await readError(res, "Falha ao listar imagens"));
      const projects = (await res.json()) as ImageLibraryProject[];
      if (!projects.length) {
        pickerStatus.textContent =
          "Nenhuma imagem gerada ainda. Crie imagens no Studio Criativo.";
        return;
      }
      pickerStatus.textContent =
        slot === "first" ? "Escolha o quadro inicial" : "Escolha o quadro final";
      pickerList.innerHTML = projects
        .map((project) => {
          const cards = (project.assets || [])
            .map((asset) => {
              const src = assetSrc(asset.localPath);
              return `<button type="button" class="videos-picker-card" data-image-asset="${escapeHtml(asset.id)}" data-image-src="${escapeHtml(src)}" data-image-name="${escapeHtml(asset.filename || "")}" aria-label="${escapeHtml(project.name)}">
                <img src="${escapeHtml(src)}" alt="" />
              </button>`;
            })
            .join("");
          return `<section class="videos-picker-project">
            <h4>${escapeHtml(project.name)}</h4>
            <div class="videos-picker-grid">${cards}</div>
          </section>`;
        })
        .join("");
    } catch (error) {
      pickerStatus.textContent = errorMessage(error, "Falha ao listar imagens");
    }
  }

  function showClip(clip: CreativeStartEndClip) {
    revokeFrame(firstFrame);
    revokeFrame(lastFrame);
    firstFrame = clip.firstFramePath
      ? { previewSrc: assetSrc(clip.firstFramePath) }
      : null;
    lastFrame = clip.lastFramePath
      ? { previewSrc: assetSrc(clip.lastFramePath) }
      : null;
    prompt = clip.prompt || "";
    current = clip;
    render();
    schedulePoll();
  }

  function resetCanvas() {
    stopPoll();
    revokeFrame(firstFrame);
    revokeFrame(lastFrame);
    firstFrame = null;
    lastFrame = null;
    prompt = "";
    current = null;
  }

  async function loadClips() {
    const res = await api("/creative/inicio-fim");
    if (!res.ok) throw new Error(await readError(res, "Falha ao listar clipes"));
    clips = (await res.json()) as CreativeStartEndClip[];
  }

  async function loadClip(id: string) {
    const cached = clips.find((item) => item.id === id);
    if (cached) {
      showClip(cached);
    }
    const res = await api(`/creative/inicio-fim/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await readError(res, "Falha ao abrir o clipe"));
    const clip = (await res.json()) as CreativeStartEndClip;
    clips = [clip, ...clips.filter((item) => item.id !== clip.id)];
    showClip(clip);
  }

  function onPaste(event: ClipboardEvent) {
    if (!active || busy) return;
    const file = Array.from(event.clipboardData?.files || []).find(isImageFile);
    if (!file) return;
    event.preventDefault();
    const slot: FrameSlot = firstFrame ? "last" : "first";
    applyFiles(slot, [file]);
  }

  async function generate() {
    if (busy || isLockedGenerating(current)) return;
    const firstFresh = frameIsFresh(firstFrame);
    const lastFresh = frameIsFresh(lastFrame);
    if ((!firstFrame || !lastFrame) && !current?.id) {
      setStatus("Envie o quadro inicial e o quadro final", true);
      return;
    }
    const shouldCreate = !current?.id || firstFresh || lastFresh;
    if (current?.status === "ready" && !shouldCreate) return;
    const targetId = current?.id;
    busy = true;
    stopPoll();
    render();
    setStatus("Gerando clipe…");
    try {
      if (shouldCreate) {
        const body = new FormData();
        if (prompt.trim()) body.append("prompt", prompt.trim());
        appendVideoRunSettings(body);
        if (firstFrame?.file) body.append("firstFrame", firstFrame.file);
        else if (firstFrame?.imageAssetId) {
          body.append("firstFrameImageAssetId", firstFrame.imageAssetId);
        }
        if (lastFrame?.file) body.append("lastFrame", lastFrame.file);
        else if (lastFrame?.imageAssetId) {
          body.append("lastFrameImageAssetId", lastFrame.imageAssetId);
        }
        if (current?.id && (!firstFresh || !lastFresh)) {
          body.append("sourceClipId", current.id);
        }
        const res = await api("/creative/inicio-fim", { method: "POST", body });
        if (!res.ok) throw new Error(await readError(res, "Falha ao gerar"));
        const clip = (await res.json()) as CreativeStartEndClip;
        clips = [clip, ...clips.filter((item) => item.id !== clip.id)];
        busy = false;
        showClip(clip);
        navigate({ name: "criativo-skill", id: INICIO_FIM_ID, clipId: clip.id });
        setStatus("");
        return;
      }
      const res = await api(
        `/creative/inicio-fim/${encodeURIComponent(current!.id)}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            ...videoRunSettingsPayload(),
          }),
        },
      );
      if (!res.ok) throw new Error(await readError(res, "Falha ao gerar"));
      const clip = (await res.json()) as CreativeStartEndClip;
      clips = [clip, ...clips.filter((item) => item.id !== clip.id)];
      busy = false;
      showClip(clip);
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao gerar o clipe"), true);
      try {
        await loadClips();
        const fallback =
          (targetId && clips.find((item) => item.id === targetId)) || clips[0];
        if (fallback) {
          busy = false;
          showClip(fallback);
        } else {
          render();
        }
      } catch {
        render();
      }
    } finally {
      busy = false;
      render();
      schedulePoll();
    }
  }

  async function deleteCurrent() {
    if (!current?.id || busy) return;
    if (!confirm("Excluir este clipe?")) return;
    busy = true;
    try {
      const res = await api(`/creative/inicio-fim/${encodeURIComponent(current.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao excluir"));
      clips = clips.filter((item) => item.id !== current?.id);
      resetCanvas();
      navigate({ name: "criativo-skill", id: INICIO_FIM_ID });
      render();
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao excluir o clipe"), true);
    } finally {
      busy = false;
    }
  }

  async function onRoute(route: AppRoute) {
    if (route.name !== "criativo-skill" || route.id !== INICIO_FIM_ID) {
      if (active) {
        document.removeEventListener("paste", onPaste);
        document.removeEventListener("keydown", onKeydown);
        unsubscribeRun?.();
        unsubscribeRun = null;
        stopPoll();
        active = false;
      }
      return;
    }
    if (!active) {
      document.addEventListener("paste", onPaste);
      document.addEventListener("keydown", onKeydown);
      unsubscribeRun = subscribeVideoRunSettings(() => {
        if (active) render();
      });
      active = true;
    }
    const seq = ++routeSeq;
    setStatus("");
    try {
      await loadClips();
      if (seq !== routeSeq) return;
      if (route.clipId) {
        await loadClip(route.clipId);
      } else if (!firstFrame && !lastFrame) {
        resetCanvas();
        render();
      } else {
        render();
      }
      document.title = titleForRoute(route, "Início e fim");
    } catch (error) {
      if (seq !== routeSeq) return;
      render();
      setStatus(errorMessage(error, "Falha ao abrir início e fim"), true);
    }
  }

  return { onRoute };
}
