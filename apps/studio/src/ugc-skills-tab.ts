import { api } from "./api";
import { PERSONAGENS_ID, UGC_SKILLS_ID } from "./creative/features";
import { navigate, titleForRoute, type AppRoute } from "./router";
import type {
  CreativeCharacter,
  CreativeCharacterAsset,
  CreativeUgcClip,
  ImageLibraryProject,
} from "./types";
import {
  appendVideoRunSettings,
  readVideoRunSettings,
  subscribeVideoRunSettings,
  videoRunSettingsPayload,
} from "./video-run-settings";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type ProductSelection = {
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

function isImageFile(file: File | undefined): file is File {
  return Boolean(file && /^image\/(jpeg|png|webp|gif)$/i.test(file.type));
}

function imageFilesFrom(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];
  const seen = new Set<File>();
  const files = [
    ...Array.from(data.files || []),
    ...Array.from(data.items || []).flatMap((item) => {
      const file = item.kind === "file" ? item.getAsFile() : null;
      return file ? [file] : [];
    }),
  ];
  return files.filter((file) => {
    if (seen.has(file) || !isImageFile(file)) return false;
    seen.add(file);
    return true;
  });
}

function transferHasFiles(data: DataTransfer | null | undefined): boolean {
  return Boolean(imageFilesFrom(data).length || data?.types.includes("Files"));
}

function heroOf(character: CreativeCharacter | undefined): CreativeCharacterAsset | undefined {
  const assets = character?.assets || [];
  return (
    [...assets].reverse().find((item) => item.kind === "sheet") ||
    [...assets].reverse().find((item) => item.kind === "photo") ||
    [...assets].reverse().find((item) => item.kind === "upload")
  );
}

export function initUgcSkillsTab(): {
  onRoute: (route: AppRoute) => void;
} {
  const composerEl = requireEl<HTMLElement>("videos-skill-form");
  const statusEl = requireEl<HTMLElement>("videos-skill-status");
  const nameInput = requireEl<HTMLInputElement>("videos-project-name");

  let clips: CreativeUgcClip[] = [];
  let characters: CreativeCharacter[] = [];
  let current: CreativeUgcClip | null = null;
  let selectedCharacterId = "";
  let product: ProductSelection | null = null;
  let prompt = "";
  let busy = false;
  let active = false;
  let routeSeq = 0;
  let pollTimer = 0;
  let unsubscribeRun: (() => void) | null = null;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function selectedCharacter(): CreativeCharacter | undefined {
    return characters.find((item) => item.id === selectedCharacterId);
  }

  function characterPreviewSrc(): string {
    if (current?.characterId === selectedCharacterId && current.firstFramePath) {
      return assetSrc(current.firstFramePath);
    }
    return assetSrc(heroOf(selectedCharacter())?.localPath);
  }

  function revokeProduct() {
    if (product?.objectUrl) URL.revokeObjectURL(product.objectUrl);
  }

  function setProduct(next: ProductSelection | null) {
    revokeProduct();
    product = next;
  }

  function productFromFile(file: File): ProductSelection {
    const objectUrl = URL.createObjectURL(file);
    return { file, previewSrc: objectUrl, objectUrl };
  }

  function applyProduct(files: FileList | File[] | null) {
    const file = Array.from(files || []).find(isImageFile);
    if (!file) {
      setStatus("Envie uma imagem JPEG, PNG, WebP ou GIF", true);
      return;
    }
    setProduct(productFromFile(file));
    render();
    setStatus("");
  }

  async function pasteProductFromClipboard() {
    try {
      const clipboard = navigator.clipboard;
      if (clipboard?.read) {
        const items = await clipboard.read();
        for (const item of items) {
          const type = item.types.find((value) => /^image\/(jpeg|png|webp|gif)$/i.test(value));
          if (!type) continue;
          const blob = await item.getType(type);
          const ext = type.split("/")[1] || "png";
          applyProduct([new File([blob], `produto.${ext}`, { type })]);
          return;
        }
      }
    } catch {
      // Permission or empty clipboard — fall through to keyboard paste.
    }
    composerEl.querySelector<HTMLElement>("[data-drop-slot='product']")?.focus();
    setStatus("Cole a imagem com Ctrl+V ou ⌘V", true);
  }

  function characterSlotMarkup(): string {
    const src = characterPreviewSrc();
    const character = selectedCharacter();
    return `<div class="inicio-fim-drop${src ? " has-frame" : ""} ugc-skills-character">
      ${
        src
          ? `<img src="${escapeHtml(src)}" alt="Personagem" />`
          : `<span class="inicio-fim-drop-empty">Escolha o criador</span>`
      }
      <em>${escapeHtml(character?.name || "Personagem")}</em>
    </div>`;
  }

  function productSlotMarkup(): string {
    return `<div class="inicio-fim-drop${product ? " has-frame" : ""}" data-drop-slot="product" tabindex="0" aria-label="Foto do produto. Cole, arraste ou envie uma imagem.">
      ${
        product
          ? `<img src="${escapeHtml(product.previewSrc)}" alt="Foto do produto" />`
          : `<span class="inicio-fim-drop-empty">Foto do produto<br /><small>Cole, arraste ou envie</small></span>`
      }
      <em>Produto</em>
      <div class="inicio-fim-drop-actions">
        <label class="inicio-fim-upload">
          <input type="file" accept="${IMAGE_ACCEPT}" data-product-input />
          Enviar
        </label>
        <button type="button" class="videos-text-btn" data-paste-product>Colar</button>
        <button type="button" class="videos-text-btn" data-pick-library>Library</button>
        ${
          product
            ? `<button type="button" class="videos-text-btn" data-clear-product>Limpar</button>`
            : ""
        }
      </div>
    </div>`;
  }

  function characterPickerMarkup(): string {
    if (!characters.length) {
      return `<p class="movies-hint">Nenhum personagem na biblioteca. <a href="/criativo/habilidade/${PERSONAGENS_ID}">Criar em Personagens</a>.</p>`;
    }
    const missingHero = characters.every((item) => !heroOf(item));
    return `${
      missingHero
        ? `<p class="movies-hint">Gere uma foto em <a href="/criativo/habilidade/${PERSONAGENS_ID}">Personagens</a> para usar o criador no anúncio.</p>`
        : ""
    }<div class="movies-cast" role="listbox" aria-label="Personagem">
      ${characters
        .map((item) => {
          const hero = heroOf(item);
          const src = assetSrc(hero?.localPath);
          const selected = item.id === selectedCharacterId;
          const disabled = !hero;
          return `<button type="button" class="movies-cast-option${selected ? " is-active" : ""}" data-character-id="${escapeHtml(item.id)}" ${disabled ? "disabled" : ""} title="${disabled ? "Gere uma foto em Personagens" : escapeHtml(item.name)}">
            ${
              src
                ? `<img src="${escapeHtml(src)}" alt="" />`
                : `<span class="movies-cast-empty"></span>`
            }
            <span>${escapeHtml(item.name)}</span>
          </button>`;
        })
        .join("")}
    </div>`;
  }

  function resultMarkup(): string {
    if (busy || current?.status === "generating") {
      return `<div class="inicio-fim-result is-busy">
        <p>Gerando o anúncio…</p>
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
      <p>O anúncio UGC aparece aqui: o personagem apresenta o produto.</p>
    </div>`;
  }

  function historyMarkup(): string {
    if (!clips.length) {
      return `<p class="criativo-empty">Nenhum anúncio ainda. Escolha o personagem, a foto do produto e gere o primeiro.</p>`;
    }
    return `<div class="inicio-fim-history">
      ${clips
        .map((clip) => {
          const src = clip.status === "ready" ? assetSrc(clip.localPath) : "";
          const first = assetSrc(clip.firstFramePath);
          const activeClip = current?.id === clip.id ? " is-active" : "";
          const portrait = clip.aspectRatio === "9:16" ? " inicio-fim-history-card--portrait" : "";
          return `<a class="inicio-fim-history-card${activeClip}${portrait}" data-clip-id="${escapeHtml(clip.id)}" href="${escapeHtml(
            `/criativo/habilidade/${UGC_SKILLS_ID}/${encodeURIComponent(clip.id)}`,
          )}">
            ${
              src
                ? `<video src="${escapeHtml(src)}" muted playsinline preload="metadata"></video>`
                : first
                  ? `<img src="${escapeHtml(first)}" alt="" />`
                  : `<span class="inicio-fim-history-empty">${escapeHtml(statusLabel(clip.status))}</span>`
            }
            <strong>${escapeHtml(clip.character?.name || "UGC")} · ${escapeHtml(clip.duration)}</strong>
            <em>${escapeHtml(statusLabel(clip.status))}</em>
          </a>`;
        })
        .join("")}
    </div>`;
  }

  function render() {
    nameInput.value = "UGC Skills";
    const hasProduct = Boolean(product?.file || product?.imageAssetId || product?.previewSrc);
    const hasCharacterHero = Boolean(characterPreviewSrc());
    const locked = isLockedGenerating(current);
    const productFresh = Boolean(product?.file || product?.imageAssetId);
    const characterChanged = Boolean(current && current.characterId !== selectedCharacterId);
    const showGenerate =
      !current || current.status !== "ready" || productFresh || characterChanged;
    const canGenerate = Boolean(
      showGenerate && selectedCharacterId && hasProduct && hasCharacterHero && !busy && !locked,
    );
    const aspectRatio = readVideoRunSettings().aspectRatio;
    composerEl.innerHTML = `
      <div class="inicio-fim-workspace">
        <div class="criativo-composer-copy">
          <p class="criativo-kicker">UGC Skills</p>
          <h3>O personagem apresenta o produto em um anúncio vertical</h3>
        </div>
        ${characterPickerMarkup()}
        <div class="inicio-fim-stage inicio-fim-stage--${aspectRatio === "9:16" ? "portrait" : "landscape"}">
          ${characterSlotMarkup()}
          <div class="inicio-fim-bridge">
            ${resultMarkup()}
          </div>
          ${productSlotMarkup()}
        </div>
        <form id="ugc-skills-form" class="inicio-fim-composer">
          <label class="inicio-fim-prompt">
            Prompt
            <textarea id="ugc-skills-prompt" rows="3" maxlength="8000" placeholder="Hook, oferta e CTA. Ex.: abre falando do problema, mostra o produto e fecha com compre agora.">${escapeHtml(prompt)}</textarea>
          </label>
          <div class="inicio-fim-toolbar">
            ${
              showGenerate
                ? `<button type="submit" id="ugc-skills-generate" ${canGenerate ? "" : "disabled"}>Gerar anúncio</button>`
                : ""
            }
            ${
              current?.id
                ? `<button type="button" id="ugc-skills-new">Novo</button>`
                : ""
            }
            ${
              current?.status === "ready" && current.localPath
                ? `<a class="videos-text-btn" href="${escapeHtml(assetSrc(current.localPath))}" download="${escapeHtml(current.filename || "anuncio.mp4")}">Baixar</a>`
                : ""
            }
            ${
              current?.id && !locked
                ? `<button type="button" class="danger" id="ugc-skills-delete">Excluir</button>`
                : ""
            }
          </div>
        </form>
        <section class="inicio-fim-strip">
          <h4>Histórico</h4>
          ${historyMarkup()}
        </section>
        <div id="ugc-skills-picker" class="videos-picker" hidden>
          <div class="videos-picker-dialog" role="dialog" aria-labelledby="ugc-skills-picker-title">
            <header>
              <h3 id="ugc-skills-picker-title">Usar imagem do studio</h3>
              <button type="button" id="ugc-skills-picker-close">Fechar</button>
            </header>
            <p class="status" id="ugc-skills-picker-status"></p>
            <div id="ugc-skills-picker-list"></div>
          </div>
        </div>
      </div>
    `;
    bind();
  }

  function bind() {
    composerEl.querySelectorAll<HTMLButtonElement>("[data-character-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.characterId;
        if (!id) return;
        selectedCharacterId = id;
        render();
      });
    });
    composerEl.querySelector<HTMLInputElement>("[data-product-input]")?.addEventListener("change", (event) => {
      const input = event.currentTarget as HTMLInputElement;
      applyProduct(input.files);
      input.value = "";
    });
    composerEl.querySelector("[data-pick-library]")?.addEventListener("click", () => {
      void openPicker();
    });
    composerEl.querySelector("[data-paste-product]")?.addEventListener("click", () => {
      void pasteProductFromClipboard();
    });
    composerEl.querySelector("[data-clear-product]")?.addEventListener("click", () => {
      setProduct(null);
      render();
    });
    const zone = composerEl.querySelector<HTMLElement>("[data-drop-slot='product']");
    let dragDepth = 0;
    zone?.addEventListener("dragenter", (event) => {
      if (!transferHasFiles(event.dataTransfer)) return;
      event.preventDefault();
      dragDepth += 1;
      zone.classList.add("is-over");
    });
    zone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      zone.classList.add("is-over");
    });
    zone?.addEventListener("dragleave", () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) zone.classList.remove("is-over");
    });
    zone?.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepth = 0;
      zone.classList.remove("is-over");
      applyProduct(imageFilesFrom(event.dataTransfer));
    });
    zone?.addEventListener("paste", (event) => {
      const files = imageFilesFrom(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      applyProduct(files);
    });
    composerEl.querySelector("#ugc-skills-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void generate();
    });
    const promptEl = composerEl.querySelector("#ugc-skills-prompt") as HTMLTextAreaElement | null;
    promptEl?.addEventListener("input", () => {
      prompt = promptEl.value;
    });
    composerEl.querySelector("#ugc-skills-new")?.addEventListener("click", () => {
      resetCanvas();
      navigate({ name: "criativo-skill", id: UGC_SKILLS_ID });
      render();
    });
    composerEl.querySelector("#ugc-skills-delete")?.addEventListener("click", () => {
      void deleteCurrent();
    });
    composerEl.querySelectorAll<HTMLAnchorElement>("[data-clip-id]").forEach((card) => {
      card.addEventListener("click", (event) => {
        event.preventDefault();
        const id = card.dataset.clipId;
        if (!id) return;
        const clip = clips.find((item) => item.id === id);
        if (clip) showClip(clip);
        navigate({ name: "criativo-skill", id: UGC_SKILLS_ID, clipId: id });
      });
    });
    composerEl.querySelector("#ugc-skills-picker-close")?.addEventListener("click", closePicker);
    composerEl.querySelector("#ugc-skills-picker")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closePicker();
    });
    composerEl.querySelector("#ugc-skills-picker-list")?.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement | null)?.closest("[data-image-asset]") as
        | HTMLElement
        | null;
      if (!btn?.dataset.imageAsset) return;
      setProduct({
        imageAssetId: btn.dataset.imageAsset,
        previewSrc: btn.dataset.imageSrc || "",
      });
      closePicker();
      render();
    });
  }

  function closePicker() {
    const picker = composerEl.querySelector("#ugc-skills-picker") as HTMLElement | null;
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
      const res = await api(`/creative/ugc-skills/${encodeURIComponent(id)}`);
      if (!res.ok) {
        schedulePoll();
        return;
      }
      const clip = (await res.json()) as CreativeUgcClip;
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

  async function openPicker() {
    const picker = composerEl.querySelector("#ugc-skills-picker") as HTMLElement | null;
    const pickerStatus = composerEl.querySelector("#ugc-skills-picker-status") as HTMLElement | null;
    const pickerList = composerEl.querySelector("#ugc-skills-picker-list") as HTMLElement | null;
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
      pickerStatus.textContent = "Escolha a foto do produto";
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

  function showClip(clip: CreativeUgcClip) {
    revokeProduct();
    selectedCharacterId = clip.characterId;
    product = clip.productPath ? { previewSrc: assetSrc(clip.productPath) } : null;
    prompt = clip.prompt || "";
    current = clip;
    render();
    schedulePoll();
  }

  function resetCanvas() {
    stopPoll();
    revokeProduct();
    product = null;
    prompt = "";
    current = null;
    selectedCharacterId =
      characters.find((item) => heroOf(item))?.id || characters[0]?.id || "";
  }

  async function loadCharacters() {
    const res = await api("/creative/characters");
    if (!res.ok) throw new Error(await readError(res, "Falha ao listar personagens"));
    characters = (await res.json()) as CreativeCharacter[];
    if (!selectedCharacterId || !characters.some((item) => item.id === selectedCharacterId)) {
      selectedCharacterId =
        characters.find((item) => heroOf(item))?.id || characters[0]?.id || "";
    }
  }

  async function loadClips() {
    const res = await api("/creative/ugc-skills");
    if (!res.ok) throw new Error(await readError(res, "Falha ao listar clipes"));
    clips = (await res.json()) as CreativeUgcClip[];
  }

  async function loadClip(id: string) {
    const cached = clips.find((item) => item.id === id);
    if (cached) showClip(cached);
    const res = await api(`/creative/ugc-skills/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await readError(res, "Falha ao abrir o clipe"));
    const clip = (await res.json()) as CreativeUgcClip;
    clips = [clip, ...clips.filter((item) => item.id !== clip.id)];
    showClip(clip);
  }

  function onPaste(event: ClipboardEvent) {
    if (!active || busy) return;
    const files = imageFilesFrom(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    applyProduct(files);
  }

  async function generate() {
    if (busy || isLockedGenerating(current)) return;
    if (!selectedCharacterId) {
      setStatus("Selecione um personagem", true);
      return;
    }
    if (!characterPreviewSrc()) {
      setStatus("Gere uma foto do personagem em Personagens antes de criar o anúncio", true);
      return;
    }
    const productFresh = Boolean(product?.file || product?.imageAssetId);
    const characterChanged = Boolean(current && current.characterId !== selectedCharacterId);
    if (!productFresh && !product?.previewSrc && !current?.id) {
      setStatus("Envie a foto do produto", true);
      return;
    }
    const shouldCreate = productFresh || characterChanged || !current?.id;
    if (current?.status === "ready" && !shouldCreate) return;
    const targetId = current?.id;
    busy = true;
    stopPoll();
    render();
    setStatus("Gerando anúncio…");
    try {
      if (shouldCreate) {
        const body = new FormData();
        body.append("characterId", selectedCharacterId);
        if (prompt.trim()) body.append("prompt", prompt.trim());
        appendVideoRunSettings(body);
        if (product?.file) body.append("product", product.file);
        else if (product?.imageAssetId) {
          body.append("productImageAssetId", product.imageAssetId);
        } else if (current?.id) {
          body.append("sourceClipId", current.id);
        }
        const res = await api("/creative/ugc-skills", { method: "POST", body });
        if (!res.ok) throw new Error(await readError(res, "Falha ao gerar"));
        const clip = (await res.json()) as CreativeUgcClip;
        clips = [clip, ...clips.filter((item) => item.id !== clip.id)];
        busy = false;
        showClip(clip);
        navigate({ name: "criativo-skill", id: UGC_SKILLS_ID, clipId: clip.id });
        setStatus("");
        return;
      }
      const res = await api(
        `/creative/ugc-skills/${encodeURIComponent(current!.id)}/generate`,
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
      const clip = (await res.json()) as CreativeUgcClip;
      clips = [clip, ...clips.filter((item) => item.id !== clip.id)];
      busy = false;
      showClip(clip);
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao gerar o anúncio"), true);
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
    if (!confirm("Excluir este anúncio?")) return;
    busy = true;
    try {
      const res = await api(`/creative/ugc-skills/${encodeURIComponent(current.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao excluir"));
      clips = clips.filter((item) => item.id !== current?.id);
      resetCanvas();
      navigate({ name: "criativo-skill", id: UGC_SKILLS_ID });
      render();
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao excluir o anúncio"), true);
    } finally {
      busy = false;
    }
  }

  async function onRoute(route: AppRoute) {
    if (route.name !== "criativo-skill" || route.id !== UGC_SKILLS_ID) {
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
      await Promise.all([loadCharacters(), loadClips()]);
      if (seq !== routeSeq) return;
      if (route.clipId) {
        await loadClip(route.clipId);
      } else if (!product && !current) {
        resetCanvas();
        render();
      } else {
        render();
      }
      document.title = titleForRoute(route, "UGC Skills");
    } catch (error) {
      if (seq !== routeSeq) return;
      render();
      setStatus(errorMessage(error, "Falha ao abrir UGC Skills"), true);
    }
  }

  return { onRoute };
}
