import { api } from "./api";
import { PERSONAGENS_ID, VIDEO_LIVRE_ID } from "./creative/features";
import { hrefFor, navigate, titleForRoute, type AppRoute } from "./router";
import type {
  CreativeCharacter,
  CreativeCharacterAsset,
  CreativeVideoLivreClip,
} from "./types";
import {
  persistVideoRunSettings,
  readVideoRunSettings,
  subscribeVideoRunSettings,
  videoRunSettingsPayload,
} from "./video-run-settings";

type VideoHook = {
  id: string;
  group?: string;
  title?: string;
  summary?: string;
  example?: string;
};

type SessionTake = {
  id: string;
  label: string;
  beat: string;
  productionPrompt: string;
  clipId?: string;
};

const MIN_TAKES = 2;
const MAX_TAKES = 5;
const DEFAULT_TAKES = 3;
const NO_VOICE_KEY = "video-livre-no-character-voice";

function clampTakeCount(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_TAKES;
  return Math.min(MAX_TAKES, Math.max(MIN_TAKES, n));
}

function readNoCharacterVoice(): boolean {
  try {
    return window.localStorage.getItem(NO_VOICE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistNoCharacterVoice(value: boolean) {
  try {
    window.localStorage.setItem(NO_VOICE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

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

function isCharacterImage(asset: CreativeCharacterAsset): boolean {
  return asset.kind !== "video" && !String(asset.mimeType || "").startsWith("video/");
}

function characterImages(character: CreativeCharacter | undefined): CreativeCharacterAsset[] {
  return (character?.assets || []).filter(isCharacterImage);
}

function characterHero(character: CreativeCharacter | undefined): CreativeCharacterAsset | undefined {
  const assets = characterImages(character);
  return (
    [...assets].reverse().find((item) => item.kind === "sheet") ||
    [...assets].reverse().find((item) => item.kind === "photo") ||
    [...assets].reverse().find((item) => item.kind === "upload")
  );
}

function characterAssetById(
  character: CreativeCharacter | undefined,
  assetId: string,
): CreativeCharacterAsset | undefined {
  const id = String(assetId || "").trim();
  if (!id) return undefined;
  return characterImages(character).find((asset) => asset.id === id);
}

export function initVideoLivreTab(): {
  onRoute: (route: AppRoute) => void;
} {
  const composerEl = requireEl<HTMLElement>("videos-skill-form");
  const statusEl = requireEl<HTMLElement>("videos-skill-status");
  const nameInput = requireEl<HTMLInputElement>("videos-project-name");

  let clips: CreativeVideoLivreClip[] = [];
  let characters: CreativeCharacter[] = [];
  let hooks: VideoHook[] = [];
  let current: CreativeVideoLivreClip | null = null;
  let brief = "";
  let prompt = "";
  let title = "";
  let note = "";
  let selectedCharacterId = "";
  let selectedAssetId = "";
  let selectedHookId = "";
  let takeCount = DEFAULT_TAKES;
  let takes: SessionTake[] = [];
  let activeTakeId = "";
  let noCharacterVoice = readNoCharacterVoice();
  let busy = false;
  let active = false;
  let routeSeq = 0;
  let pollTimer = 0;
  let unsubscribeRun: (() => void) | null = null;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function forcePortraitAspect() {
    const settings = readVideoRunSettings();
    if (settings.aspectRatio === "9:16") return;
    persistVideoRunSettings({ ...settings, aspectRatio: "9:16" });
  }

  function selectedCharacter(): CreativeCharacter | undefined {
    return characters.find((item) => item.id === selectedCharacterId);
  }

  function resetCanvas() {
    current = null;
    brief = "";
    prompt = "";
    title = "";
    note = "";
    selectedCharacterId = "";
    selectedAssetId = "";
    selectedHookId = "";
    takes = [];
    activeTakeId = "";
  }

  function activeTake(): SessionTake | undefined {
    return takes.find((item) => item.id === activeTakeId) || takes[0];
  }

  function syncTakesFromForm() {
    composerEl.querySelectorAll<HTMLTextAreaElement>("[data-vl-take-prompt]").forEach((node) => {
      const id = node.dataset.vlTakePrompt || "";
      const take = takes.find((item) => item.id === id);
      if (take) take.productionPrompt = node.value;
    });
  }

  function syncActionButtons() {
    const locked = isLockedGenerating(current);
    const briefEl = composerEl.querySelector(
      "#video-livre-brief",
    ) as HTMLTextAreaElement | null;
    const promptEl = composerEl.querySelector(
      "#video-livre-prompt",
    ) as HTMLTextAreaElement | null;
    if (briefEl) brief = briefEl.value;
    if (promptEl) prompt = promptEl.value;
    syncTakesFromForm();
    const breakMode = takes.length > 0;
    const take = activeTake();
    const generatePrompt = breakMode ? take?.productionPrompt || "" : prompt;
    const scriptReady = Boolean((prompt.trim() || brief.trim()).length >= 3);
    const refineBtn = composerEl.querySelector(
      "#video-livre-refine",
    ) as HTMLButtonElement | null;
    const breakBtn = composerEl.querySelector(
      "#video-livre-break",
    ) as HTMLButtonElement | null;
    const generateBtn = composerEl.querySelector(
      "#video-livre-generate",
    ) as HTMLButtonElement | null;
    if (refineBtn) refineBtn.disabled = busy || locked || brief.trim().length < 3;
    if (breakBtn) breakBtn.disabled = busy || locked || !scriptReady;
    if (generateBtn) {
      generateBtn.disabled = Boolean(!generatePrompt.trim() || busy || locked);
    }
  }

  function applyClip(clip: CreativeVideoLivreClip) {
    current = clip;
    brief = clip.brief || "";
    prompt = clip.prompt || "";
    title = clip.title || "";
    selectedCharacterId = clip.characterId || "";
    selectedAssetId = clip.characterAssetId || "";
    selectedHookId = clip.videoHookId || "";
    if (selectedCharacterId && !selectedAssetId) {
      selectedAssetId = characterHero(selectedCharacter())?.id || "";
    }
  }

  function resultMarkup(): string {
    if (isLockedGenerating(current)) {
      return `<div class="inicio-fim-result is-busy"><p>Gerando o vídeo…</p></div>`;
    }
    if (current?.status === "failed") {
      return `<div class="inicio-fim-result is-failed"><p>${escapeHtml(current.error || "Falha")}</p></div>`;
    }
    if (current?.status === "ready" && current.localPath) {
      return `<div class="inicio-fim-result is-ready">
        <video src="${escapeHtml(assetSrc(current.localPath))}" controls playsinline></video>
      </div>`;
    }
    return `<div class="inicio-fim-result is-idle"><p>Briefing → prompt → gerar</p></div>`;
  }

  function historyMarkup(): string {
    if (!clips.length) {
      return `<p class="movies-hint">Nenhum clipe ainda.</p>`;
    }
    return `<div class="inicio-fim-history">
      ${clips
        .map((clip) => {
          const activeClip = current?.id === clip.id ? " is-active" : "";
          const portrait = clip.aspectRatio === "9:16" ? " inicio-fim-history-card--portrait" : "";
          const src = assetSrc(clip.localPath);
          const hero = characterHero(clip.character);
          const thumb = assetSrc(hero?.localPath);
          return `<a class="inicio-fim-history-card${activeClip}${portrait}" data-clip-id="${escapeHtml(clip.id)}" href="${escapeHtml(
            hrefFor({ name: "criativo-skill", id: VIDEO_LIVRE_ID, clipId: clip.id }),
          )}">
            ${
              src
                ? `<video src="${escapeHtml(src)}" muted playsinline preload="metadata"></video>`
                : thumb
                  ? `<img src="${escapeHtml(thumb)}" alt="" />`
                  : `<span class="inicio-fim-history-empty">${escapeHtml(statusLabel(clip.status))}</span>`
            }
            <strong>${escapeHtml(clip.title || "Vídeo livre")} · ${escapeHtml(clip.duration)}</strong>
            <em>${escapeHtml(statusLabel(clip.status))}</em>
          </a>`;
        })
        .join("")}
    </div>`;
  }

  function castMarkup(): string {
    if (!characters.length) {
      return `<p class="movies-hint">Nenhum personagem. <a href="/criativo/habilidade/${PERSONAGENS_ID}">Criar</a>.</p>`;
    }
    const noneActive = !selectedCharacterId;
    return `<div class="movies-cast video-livre-cast" role="listbox" aria-label="Personagem">
      <button type="button" class="movies-cast-option${noneActive ? " is-active" : ""}" data-character-id="" aria-pressed="${noneActive ? "true" : "false"}">
        <span class="movies-cast-empty"></span>
        <span>Nenhum</span>
      </button>
      ${characters
        .map((item) => {
          const chosen =
            (item.id === selectedCharacterId
              ? characterAssetById(item, selectedAssetId)
              : undefined) || characterHero(item);
          const src = assetSrc(chosen?.localPath);
          const selected = item.id === selectedCharacterId;
          const disabled = !characterHero(item);
          return `<button type="button" class="movies-cast-option${selected ? " is-active" : ""}" data-character-id="${escapeHtml(item.id)}" ${disabled ? "disabled" : ""} aria-pressed="${selected ? "true" : "false"}" title="${disabled ? "Gere uma foto em Personagens" : `Escolher foto de ${escapeHtml(item.name)}`}">
            ${src ? `<img src="${escapeHtml(src)}" alt="" />` : `<span class="movies-cast-empty"></span>`}
            <span>${escapeHtml(item.name)}</span>
          </button>`;
        })
        .join("")}
    </div>`;
  }

  function hooksButtonMarkup(): string {
    const hook = hooks.find((item) => item.id === selectedHookId);
    return `<button type="button" class="content-plan-hooks-btn video-livre-hook-btn${selectedHookId ? " is-active" : ""}" data-vl-hooks title="${escapeHtml(hook?.summary || "Hook visual opcional")}">
      ${hook ? escapeHtml(hook.title || hook.id) : "Hook visual"}
    </button>`;
  }

  function characterModalMarkup(): string {
    return `<div class="videos-picker" data-vl-character-modal hidden>
      <div class="videos-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="video-livre-character-title">
        <header>
          <h3 id="video-livre-character-title">Escolha a foto do personagem</h3>
          <button type="button" data-vl-character-close>Fechar</button>
        </header>
        <p class="movies-hint" data-vl-character-status></p>
        <div class="videos-picker-grid" data-vl-character-grid></div>
        <p class="movies-toolbar">
          <button type="button" class="outline danger" data-vl-character-remove hidden>Remover personagem</button>
        </p>
      </div>
    </div>`;
  }

  function hooksModalMarkup(): string {
    return `<div class="videos-picker content-plan-hooks-modal" data-vl-hooks-modal hidden>
      <div class="videos-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="video-livre-hooks-title">
        <header>
          <h3 id="video-livre-hooks-title">Hooks visuais</h3>
          <button type="button" data-vl-hooks-close>Fechar</button>
        </header>
        <p class="movies-hint">Estilo de câmera e mundo — não uma cena pronta.</p>
        <div data-vl-hooks-list></div>
      </div>
    </div>`;
  }

  function takesMarkup(): string {
    if (!takes.length) return "";
    const take = activeTake();
    return `<div class="video-livre-takes">
      <div class="video-livre-takes-head">
        <span class="content-plan-legend">Takes</span>
        <button type="button" class="outline" id="video-livre-clear-takes" ${busy || isLockedGenerating(current) ? "disabled" : ""}>Sair</button>
      </div>
      <div class="video-livre-takes-list" role="listbox" aria-label="Takes">
        ${takes
          .map((item) => {
            const selected = item.id === activeTakeId;
            const ready = Boolean(item.clipId);
            return `<button type="button" class="video-livre-take${selected ? " is-active" : ""}${ready ? " is-ready" : ""}" data-vl-take-id="${escapeHtml(item.id)}" aria-pressed="${selected ? "true" : "false"}">
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(ready ? "Pronta" : item.beat || "Editar")}</span>
            </button>`;
          })
          .join("")}
      </div>
      ${
        take
          ? `<label class="inicio-fim-prompt video-livre-take-editor">
            ${escapeHtml(take.label)}
            <textarea data-vl-take-prompt="${escapeHtml(take.id)}" rows="4" maxlength="4000" placeholder="Briefing desta take">${escapeHtml(take.productionPrompt)}</textarea>
          </label>`
          : ""
      }
    </div>`;
  }

  function render() {
    nameInput.value = "Vídeo livre";
    const locked = isLockedGenerating(current);
    const breakMode = takes.length > 0;
    const take = activeTake();
    const generatePrompt = breakMode ? take?.productionPrompt || "" : prompt;
    const canGenerate = Boolean(generatePrompt.trim() && !busy && !locked);
    const scriptReady = Boolean((prompt.trim() || brief.trim()).length >= 3);
    composerEl.innerHTML = `
      <div class="inicio-fim-workspace video-livre-workspace">
        <header class="video-livre-head">
          <div>
            <p class="criativo-kicker">Vídeo livre</p>
            <h3>Roteiro → takes → gerar</h3>
          </div>
          <div class="video-livre-head-actions">
            <label class="video-livre-mute-voice">
              <input type="checkbox" id="video-livre-no-voice" ${noCharacterVoice ? "checked" : ""} ${busy || locked ? "disabled" : ""} />
              Sem voz
            </label>
            ${hooksButtonMarkup()}
          </div>
        </header>

        <div class="video-livre-layout">
          <aside class="video-livre-preview">
            <div class="inicio-fim-stage inicio-fim-stage--portrait video-livre-stage">
              <div class="inicio-fim-bridge">${resultMarkup()}</div>
            </div>
            <div class="video-livre-preview-actions">
              <button type="submit" form="video-livre-form" id="video-livre-generate" ${canGenerate ? "" : "disabled"}>${
                breakMode ? `Gerar ${escapeHtml(take?.label || "take")}` : "Gerar vídeo"
              }</button>
              ${
                current?.status === "ready" && current.localPath
                  ? `<a class="videos-text-btn" href="${escapeHtml(assetSrc(current.localPath))}" download="${escapeHtml(current.filename || "video.mp4")}">Baixar</a>`
                  : ""
              }
              ${current?.id || breakMode ? `<button type="button" id="video-livre-new">Novo</button>` : ""}
              ${
                current?.id && !locked
                  ? `<button type="button" class="danger" id="video-livre-delete">Excluir</button>`
                  : ""
              }
            </div>
          </aside>

          <form id="video-livre-form" class="inicio-fim-composer video-livre-editor">
            <section class="video-livre-section">
              <div class="video-livre-section-head">
                <span class="content-plan-legend">Personagem</span>
              </div>
              ${castMarkup()}
            </section>

            <section class="video-livre-section">
              <label class="inicio-fim-prompt">
                Briefing
                <textarea id="video-livre-brief" rows="2" maxlength="4000" placeholder="Ideia: assunto, ação, tom, CTA">${escapeHtml(brief)}</textarea>
              </label>
              <div class="video-livre-refine-row">
                <label class="inicio-fim-prompt video-livre-note">
                  Ajuste (opcional)
                  <input id="video-livre-note" maxlength="800" placeholder="mais direto, abre com gancho…" value="${escapeHtml(note)}" />
                </label>
                <button type="button" class="secondary" id="video-livre-refine" ${busy || locked || brief.trim().length < 3 ? "disabled" : ""}>Aprimorar</button>
              </div>
              <label class="inicio-fim-prompt">
                Prompt de produção
                <textarea id="video-livre-prompt" rows="${breakMode ? 2 : 4}" maxlength="8000" placeholder="Roteiro pronto para gerar">${escapeHtml(prompt)}</textarea>
              </label>
              <div class="video-livre-break-bar">
                <label class="video-livre-take-count">N
                  <select id="video-livre-take-count" ${busy || locked ? "disabled" : ""}>
                    ${[2, 3, 4, 5]
                      .map(
                        (n) =>
                          `<option value="${n}" ${n === takeCount ? "selected" : ""}>${n}</option>`,
                      )
                      .join("")}
                  </select>
                </label>
                <button type="button" class="secondary" id="video-livre-break" ${busy || locked || !scriptReady ? "disabled" : ""}>Partir em ${takeCount}</button>
              </div>
            </section>

            ${takesMarkup()}
          </form>
        </div>

        <section class="inicio-fim-strip video-livre-history">
          <h4>Histórico</h4>
          ${historyMarkup()}
        </section>
        ${characterModalMarkup()}
        ${hooksModalMarkup()}
      </div>
    `;
    bind();
  }

  function closeCharacterModal() {
    const modal = composerEl.querySelector<HTMLElement>("[data-vl-character-modal]");
    if (modal) modal.hidden = true;
  }

  function openCharacterModal(characterId: string) {
    const character = characters.find((item) => item.id === characterId);
    if (!character) return;
    const modal = composerEl.querySelector<HTMLElement>("[data-vl-character-modal]");
    const titleEl = composerEl.querySelector<HTMLElement>("#video-livre-character-title");
    const statusNode = composerEl.querySelector<HTMLElement>("[data-vl-character-status]");
    const grid = composerEl.querySelector<HTMLElement>("[data-vl-character-grid]");
    const remove = composerEl.querySelector<HTMLButtonElement>("[data-vl-character-remove]");
    if (!modal || !titleEl || !statusNode || !grid || !remove) return;
    const images = characterImages(character);
    const currentId =
      (selectedCharacterId === characterId ? selectedAssetId : "") ||
      characterHero(character)?.id ||
      "";
    titleEl.textContent = `Escolha a foto de ${character.name}`;
    statusNode.textContent = images.length
      ? "A imagem escolhida entra como quadro inicial do vídeo."
      : "Este personagem ainda não tem imagens.";
    grid.innerHTML = images
      .map((asset) => {
        const src = assetSrc(asset.localPath);
        const selected = asset.id === currentId;
        return `<button type="button" class="videos-picker-card movies-character-image-option${selected ? " is-active" : ""}" data-vl-character-asset="${escapeHtml(asset.id || "")}" aria-pressed="${selected ? "true" : "false"}">
          ${src ? `<img src="${escapeHtml(src)}" alt="" />` : ""}
          <span>${escapeHtml(asset.filename || asset.kind || "foto")}</span>
        </button>`;
      })
      .join("");
    remove.hidden = selectedCharacterId !== characterId;
    modal.hidden = false;
    modal.dataset.characterId = characterId;
  }

  function closeHooksModal() {
    const modal = composerEl.querySelector<HTMLElement>("[data-vl-hooks-modal]");
    if (modal) modal.hidden = true;
  }

  function openHooksModal() {
    const modal = composerEl.querySelector<HTMLElement>("[data-vl-hooks-modal]");
    const list = composerEl.querySelector<HTMLElement>("[data-vl-hooks-list]");
    if (!modal || !list) return;
    const noneActive = !selectedHookId;
    list.innerHTML = `
      <button type="button" class="videos-picker-card${noneActive ? " is-active" : ""}" data-vl-hook-id="">
        <strong>Nenhum hook</strong>
        <span>Gerar só com o briefing${selectedCharacterId ? " e o personagem" : ""}.</span>
      </button>
      ${hooks
        .map((item) => {
          const activeHook = item.id === selectedHookId;
          return `<button type="button" class="videos-picker-card${activeHook ? " is-active" : ""}" data-vl-hook-id="${escapeHtml(item.id)}">
            <strong>${escapeHtml(item.title || item.id)}</strong>
            <span>${escapeHtml(item.summary || "")}</span>
            ${item.example ? `<em>${escapeHtml(item.example)}</em>` : ""}
          </button>`;
        })
        .join("")}
    `;
    modal.hidden = false;
  }

  function bind() {
    composerEl.querySelectorAll<HTMLButtonElement>("[data-character-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.characterId || "";
        if (!id) {
          selectedCharacterId = "";
          selectedAssetId = "";
          render();
          return;
        }
        openCharacterModal(id);
      });
    });
    composerEl.querySelector("[data-vl-character-close]")?.addEventListener("click", () => {
      closeCharacterModal();
    });
    composerEl.querySelector("[data-vl-character-modal]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeCharacterModal();
    });
    composerEl.querySelector("[data-vl-character-remove]")?.addEventListener("click", () => {
      selectedCharacterId = "";
      selectedAssetId = "";
      closeCharacterModal();
      render();
    });
    composerEl.querySelector("[data-vl-character-grid]")?.addEventListener("click", (event) => {
      const card = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
        "[data-vl-character-asset]",
      );
      const modal = composerEl.querySelector<HTMLElement>("[data-vl-character-modal]");
      const characterId = modal?.dataset.characterId || "";
      const assetId = card?.dataset.vlCharacterAsset || "";
      if (!characterId || !assetId) return;
      selectedCharacterId = characterId;
      selectedAssetId = assetId;
      closeCharacterModal();
      render();
    });
    composerEl.querySelector("[data-vl-hooks]")?.addEventListener("click", () => {
      openHooksModal();
    });
    composerEl.querySelector("[data-vl-hooks-close]")?.addEventListener("click", () => {
      closeHooksModal();
    });
    composerEl.querySelector("[data-vl-hooks-modal]")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeHooksModal();
    });
    composerEl.querySelector("[data-vl-hooks-list]")?.addEventListener("click", (event) => {
      const card = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
        "[data-vl-hook-id]",
      );
      if (!card) return;
      selectedHookId = card.dataset.vlHookId || "";
      closeHooksModal();
      render();
    });
    composerEl.querySelector("#video-livre-brief")?.addEventListener("input", (event) => {
      brief = (event.target as HTMLTextAreaElement).value;
      syncActionButtons();
    });
    composerEl.querySelector("#video-livre-note")?.addEventListener("input", (event) => {
      note = (event.target as HTMLInputElement).value;
    });
    composerEl.querySelector("#video-livre-prompt")?.addEventListener("input", (event) => {
      prompt = (event.target as HTMLTextAreaElement).value;
      syncActionButtons();
    });
    composerEl.querySelector("#video-livre-take-count")?.addEventListener("change", (event) => {
      takeCount = clampTakeCount((event.target as HTMLSelectElement).value);
      render();
    });
    composerEl.querySelector("#video-livre-no-voice")?.addEventListener("change", (event) => {
      noCharacterVoice = (event.target as HTMLInputElement).checked;
      persistNoCharacterVoice(noCharacterVoice);
    });
    composerEl.querySelector("#video-livre-break")?.addEventListener("click", () => {
      void breakIntoTakes();
    });
    composerEl.querySelector("#video-livre-clear-takes")?.addEventListener("click", () => {
      takes = [];
      activeTakeId = "";
      render();
    });
    composerEl.querySelectorAll<HTMLButtonElement>("[data-vl-take-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        syncTakesFromForm();
        const id = btn.dataset.vlTakeId || "";
        if (!id) return;
        activeTakeId = id;
        const take = takes.find((item) => item.id === id);
        if (take?.clipId) {
          void loadClip(take.clipId);
          return;
        }
        render();
      });
    });
    composerEl.querySelectorAll<HTMLTextAreaElement>("[data-vl-take-prompt]").forEach((node) => {
      node.addEventListener("input", () => {
        const id = node.dataset.vlTakePrompt || "";
        const take = takes.find((item) => item.id === id);
        if (take) take.productionPrompt = node.value;
        syncActionButtons();
      });
    });
    composerEl.querySelector("#video-livre-refine")?.addEventListener("click", () => {
      void refinePrompt();
    });
    composerEl.querySelector("#video-livre-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void generateClip();
    });
    composerEl.querySelector("#video-livre-new")?.addEventListener("click", () => {
      resetCanvas();
      navigate({ name: "criativo-skill", id: VIDEO_LIVRE_ID });
      render();
    });
    composerEl.querySelector("#video-livre-delete")?.addEventListener("click", () => {
      void deleteClip();
    });
    composerEl.querySelectorAll<HTMLAnchorElement>("[data-clip-id]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const id = link.dataset.clipId;
        if (!id) return;
        navigate({ name: "criativo-skill", id: VIDEO_LIVRE_ID, clipId: id });
        void loadClip(id);
      });
    });
  }

  async function loadCharacters() {
    const res = await api("/creative/characters");
    if (!res.ok) throw new Error(await readError(res, "Falha ao listar personagens"));
    characters = (await res.json()) as CreativeCharacter[];
  }

  async function loadHooks() {
    const res = await api("/creative/video-livre/hooks");
    if (!res.ok) throw new Error(await readError(res, "Falha ao listar hooks"));
    hooks = (await res.json()) as VideoHook[];
  }

  async function loadClips() {
    const res = await api("/creative/video-livre");
    if (!res.ok) throw new Error(await readError(res, "Falha ao listar clipes"));
    clips = (await res.json()) as CreativeVideoLivreClip[];
  }

  async function loadClip(id: string) {
    const res = await api(`/creative/video-livre/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await readError(res, "Clipe não encontrado"));
    const clip = (await res.json()) as CreativeVideoLivreClip;
    applyClip(clip);
    render();
    if (isLockedGenerating(clip)) startPoll(clip.id);
  }

  function stopPoll() {
    if (pollTimer) {
      window.clearInterval(pollTimer);
      pollTimer = 0;
    }
  }

  function startPoll(id: string) {
    stopPoll();
    pollTimer = window.setInterval(() => {
      void (async () => {
        try {
          const res = await api(`/creative/video-livre/${encodeURIComponent(id)}`);
          if (!res.ok) return;
          const clip = (await res.json()) as CreativeVideoLivreClip;
          applyClip(clip);
          const index = clips.findIndex((item) => item.id === clip.id);
          if (index >= 0) clips[index] = clip;
          else clips = [clip, ...clips];
          render();
          if (!isLockedGenerating(clip)) stopPoll();
        } catch {
          // ignore
        }
      })();
    }, 4000);
  }

  async function breakIntoTakes() {
    if (busy) return;
    brief = (
      composerEl.querySelector("#video-livre-brief") as HTMLTextAreaElement | null
    )?.value.trim() || brief;
    prompt = (
      composerEl.querySelector("#video-livre-prompt") as HTMLTextAreaElement | null
    )?.value.trim() || prompt;
    takeCount = clampTakeCount(
      (composerEl.querySelector("#video-livre-take-count") as HTMLSelectElement | null)?.value ||
        takeCount,
    );
    const script = prompt.trim() || brief.trim();
    if (script.length < 3) {
      setStatus("Informe o roteiro (prompt ou briefing)", true);
      return;
    }
    busy = true;
    setStatus(`Partindo em ${takeCount} vídeos…`);
    try {
      const res = await api("/creative/video-livre/break", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          takeCount,
          videoHookId: selectedHookId || undefined,
          noCharacterVoice: noCharacterVoice || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao partir o roteiro"));
      const data = (await res.json()) as {
        takes?: Array<{
          id?: string;
          label?: string;
          beat?: string;
          productionPrompt?: string;
        }>;
      };
      takes = (data.takes || [])
        .map((item, index) => ({
          id: String(item.id || `take-${index + 1}`),
          label: String(item.label || `Take ${index + 1}`),
          beat: String(item.beat || ""),
          productionPrompt: String(item.productionPrompt || ""),
        }))
        .filter((item) => item.productionPrompt);
      if (!takes.length) throw new Error("A IA não partiu o roteiro");
      activeTakeId = takes[0].id;
      current = null;
      setStatus(`${takes.length} takes prontas — edite e gere uma por vez`);
      render();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao partir o roteiro"), true);
    } finally {
      busy = false;
    }
  }

  async function refinePrompt() {
    if (busy) return;
    const nextBrief = (
      composerEl.querySelector("#video-livre-brief") as HTMLTextAreaElement | null
    )?.value.trim() || brief.trim();
    const nextNote = (
      composerEl.querySelector("#video-livre-note") as HTMLInputElement | null
    )?.value.trim() || note.trim();
    if (nextBrief.length < 3) {
      setStatus("Informe um briefing", true);
      return;
    }
    busy = true;
    setStatus("Aprimorando o roteiro…");
    try {
      const res = await api("/creative/video-livre/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: nextBrief,
          note: nextNote || undefined,
          videoHookId: selectedHookId || undefined,
          noCharacterVoice: noCharacterVoice || undefined,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao aprimorar"));
      const data = (await res.json()) as { title?: string; productionPrompt?: string };
      brief = nextBrief;
      note = nextNote;
      title = data.title || title;
      prompt = data.productionPrompt || prompt;
      setStatus("Roteiro atualizado");
      render();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao aprimorar"), true);
    } finally {
      busy = false;
    }
  }

  async function generateClip() {
    if (busy) return;
    brief = (
      composerEl.querySelector("#video-livre-brief") as HTMLTextAreaElement | null
    )?.value.trim() || brief;
    prompt = (
      composerEl.querySelector("#video-livre-prompt") as HTMLTextAreaElement | null
    )?.value.trim() || prompt;
    syncTakesFromForm();
    const breakMode = takes.length > 0;
    const take = breakMode ? activeTake() : undefined;
    const nextPrompt = breakMode ? take?.productionPrompt.trim() || "" : prompt;
    if (!nextPrompt) {
      setStatus(
        breakMode ? "Informe o prompt desta take" : "Informe o prompt de produção",
        true,
      );
      return;
    }
    const clipTitle = breakMode
      ? [title || "Vídeo livre", take?.label].filter(Boolean).join(" · ")
      : title || undefined;
    busy = true;
    setStatus(breakMode ? `Gerando ${take?.label || "take"}…` : "Gerando vídeo…");
    try {
      const payload = {
        title: clipTitle,
        brief,
        prompt: nextPrompt,
        characterId: selectedCharacterId || undefined,
        characterAssetId: selectedAssetId || undefined,
        videoHookId: selectedHookId || "",
        noCharacterVoice: noCharacterVoice || undefined,
        ...videoRunSettingsPayload(),
        aspectRatio: "9:16",
      };
      let clip: CreativeVideoLivreClip;
      const regenerateId = breakMode
        ? take?.clipId
        : current?.id && current.status !== "ready"
          ? current.id
          : undefined;
      if (regenerateId) {
        const res = await api(
          `/creative/video-livre/${encodeURIComponent(regenerateId)}/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) throw new Error(await readError(res, "Falha ao gerar"));
        clip = (await res.json()) as CreativeVideoLivreClip;
      } else {
        const res = await api("/creative/video-livre", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await readError(res, "Falha ao gerar"));
        clip = (await res.json()) as CreativeVideoLivreClip;
      }
      applyClip(clip);
      if (breakMode && take) {
        take.clipId = clip.id;
        prompt = nextPrompt;
      }
      const index = clips.findIndex((item) => item.id === clip.id);
      if (index >= 0) clips[index] = clip;
      else clips = [clip, ...clips];
      navigate({ name: "criativo-skill", id: VIDEO_LIVRE_ID, clipId: clip.id });
      setStatus(clip.status === "ready" ? "Vídeo pronto" : "Gerando…");
      render();
      if (isLockedGenerating(clip)) startPoll(clip.id);
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao gerar"), true);
    } finally {
      busy = false;
    }
  }

  async function deleteClip() {
    if (!current?.id || busy) return;
    if (!window.confirm("Excluir este clipe?")) return;
    busy = true;
    try {
      const res = await api(`/creative/video-livre/${encodeURIComponent(current.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao excluir"));
      clips = clips.filter((item) => item.id !== current?.id);
      resetCanvas();
      navigate({ name: "criativo-skill", id: VIDEO_LIVRE_ID });
      setStatus("Clipe excluído");
      render();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao excluir"), true);
    } finally {
      busy = false;
    }
  }

  async function onRoute(route: AppRoute) {
    if (route.name !== "criativo-skill" || route.id !== VIDEO_LIVRE_ID) {
      if (active) {
        unsubscribeRun?.();
        unsubscribeRun = null;
        stopPoll();
        active = false;
      }
      routeSeq += 1;
      return;
    }
    if (!active) {
      unsubscribeRun = subscribeVideoRunSettings(() => {
        if (active) render();
      });
      active = true;
    }
    const seq = ++routeSeq;
    setStatus("");
    forcePortraitAspect();
    if (!route.clipId && !current) resetCanvas();
    render();
    document.title = titleForRoute(route, "Vídeo livre");
    try {
      await Promise.all([loadCharacters(), loadHooks(), loadClips()]);
      if (seq !== routeSeq) return;
      if (route.clipId) {
        await loadClip(route.clipId);
      } else {
        render();
      }
    } catch (error) {
      if (seq !== routeSeq) return;
      render();
      setStatus(errorMessage(error, "Falha ao abrir Vídeo livre"), true);
    }
  }

  return { onRoute };
}
