import { api } from "./api";
import { MOVIES_ID } from "./creative/features";
import {
  DEFAULT_MOVIE_CAMERA,
  DEFAULT_MOVIE_FRAMING,
  MOVIE_CAMERAS,
  MOVIE_FRAMINGS,
  resolveMovieCameraId,
  resolveMovieFramingId,
  type MovieDirectionOption,
} from "./movies-direction";
import { navigate, titleForRoute, type AppRoute } from "./router";
import type {
  CreativeCharacter,
  CreativeCharacterAsset,
  CreativeMovie,
  CreativeMovieShot,
} from "./types";
import { videoRunSettingsPayload } from "./video-run-settings";

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

function assetSrc(asset: Pick<CreativeCharacterAsset, "localPath"> | undefined): string {
  if (!asset?.localPath) return "";
  return `/${asset.localPath.replace(/^\/+/, "")}`;
}

function clipSrc(shot: CreativeMovieShot): string {
  if (!shot.localPath) return "";
  return `/${shot.localPath.replace(/^\/+/, "")}`;
}

function isCharacterImage(asset: CreativeCharacterAsset): boolean {
  return asset.kind !== "video" && !(asset.mimeType || "").startsWith("video/");
}

function heroOf(character: CreativeCharacter | undefined): CreativeCharacterAsset | undefined {
  const assets = (character?.assets || []).filter(isCharacterImage);
  return (
    [...assets].reverse().find((item) => item.kind === "sheet") ||
    [...assets].reverse().find((item) => item.kind === "photo") ||
    [...assets].reverse().find((item) => item.kind === "upload")
  );
}

function shotCharacterIds(shot: CreativeMovieShot): string[] {
  const fromCast = (shot.cast || [])
    .map((item) => item.characterId || item.character?.id || "")
    .filter(Boolean);
  if (fromCast.length) return [...new Set(fromCast)];
  return shot.characterId ? [shot.characterId] : [];
}

function shotCharacters(shot: CreativeMovieShot): CreativeCharacter[] {
  const fromCast = (shot.cast || [])
    .map((item) => item.character)
    .filter((item): item is CreativeCharacter => Boolean(item));
  if (fromCast.length) return fromCast;
  return shot.character ? [shot.character] : [];
}

function isLockedGenerating(shot: { status: string; updatedAt?: string } | null): boolean {
  if (shot?.status !== "generating") return false;
  const at = shot.updatedAt ? Date.parse(shot.updatedAt) : NaN;
  if (!Number.isFinite(at)) return true;
  return Date.now() - at < 12 * 60 * 1000;
}

function statusLabel(status: string): string {
  if (status === "ready") return "Pronto";
  if (status === "generating") return "Gerando";
  if (status === "failed") return "Falhou";
  return "Rascunho";
}

function hasGeneratedClip(shot: CreativeMovieShot): boolean {
  return Boolean(shot.localPath) || shot.status === "ready";
}

function generateButtonLabel(shot: CreativeMovieShot): string {
  return hasGeneratedClip(shot) ? "Regerar take" : "Gerar take";
}

function takePreview(shot: CreativeMovieShot): string {
  const text = (shot.scene || shot.action || "").replace(/\s+/g, " ").trim();
  if (!text) return "Sem cenário ainda";
  return text.length > 72 ? `${text.slice(0, 71)}…` : text;
}

function takeCastLabel(shot: CreativeMovieShot): string {
  const names = shotCharacters(shot)
    .map((item) => item.name)
    .filter(Boolean);
  return names.join(" · ");
}

export function initMoviesTab(): {
  onRoute: (route: AppRoute) => void;
} {
  const composerEl = requireEl<HTMLElement>("videos-skill-form");
  const statusEl = requireEl<HTMLElement>("videos-skill-status");
  const nameInput = requireEl<HTMLInputElement>("videos-project-name");

  let movies: CreativeMovie[] = [];
  let characters: CreativeCharacter[] = [];
  let busy = false;
  let mode: "list" | "create" | "board" = "list";
  let boardMovie: CreativeMovie | null = null;
  let newTakeAssets = new Map<string, string>();
  let newTakeFraming = DEFAULT_MOVIE_FRAMING;
  let newTakeCamera = DEFAULT_MOVIE_CAMERA;
  let selectedShotId: string | "new" | null = null;
  let pickerCharacterId: string | null = null;
  let pickerShotId: string | null = null;
  let routeSeq = 0;
  let playIndex = 0;
  let playList: string[] = [];

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function firstReadyClip(movie: CreativeMovie): string {
    const shot = (movie.shots || []).find((item) => item.status === "ready" && item.localPath);
    return shot ? clipSrc(shot) : "";
  }

  function renderList() {
    mode = "list";
    boardMovie = null;
    selectedShotId = null;
    nameInput.value = "Filmes";
    const cards = movies
      .map((item) => {
        const src = firstReadyClip(item);
        const count = (item.shots || []).length;
        return `<a class="movies-card" data-movie-id="${escapeHtml(item.id)}" href="${escapeHtml(
          `/criativo/habilidade/movies/${encodeURIComponent(item.id)}`,
        )}">
          ${
            src
              ? `<video src="${escapeHtml(src)}" muted playsinline preload="metadata"></video>`
              : `<span class="movies-card-empty">Storyboard</span>`
          }
          <strong>${escapeHtml(item.title)}</strong>
          <em>${count} take${count === 1 ? "" : "s"} · ${escapeHtml(item.aspectRatio)}</em>
        </a>`;
      })
      .join("");
    composerEl.innerHTML = `
      <div class="movies-workspace">
        <div class="criativo-composer-copy">
          <p class="criativo-kicker">Filmes</p>
          <h3>Storyboard de takes com os personagens</h3>
        </div>
        <p class="movies-toolbar">
          <button type="button" id="movies-new">Novo filme</button>
        </p>
        <div class="movies-grid">
          ${cards || `<p class="criativo-empty">Nenhum filme ainda. Monte o primeiro storyboard.</p>`}
        </div>
      </div>
    `;
    composerEl.querySelector("#movies-new")?.addEventListener("click", () => {
      renderCreate();
    });
    composerEl.querySelectorAll<HTMLAnchorElement>("[data-movie-id]").forEach((card) => {
      card.addEventListener("click", (event) => {
        event.preventDefault();
        const id = card.dataset.movieId;
        if (!id) return;
        const cached = movies.find((item) => item.id === id);
        if (cached) renderBoard(cached);
        navigate({ name: "criativo-skill", id: MOVIES_ID, movieId: id });
      });
    });
  }

  function renderCreate() {
    mode = "create";
    boardMovie = null;
    selectedShotId = null;
    nameInput.value = "Novo filme";
    composerEl.innerHTML = `
      <form id="movies-create-form" class="criativo-flyer-form">
        <div class="criativo-composer-copy">
          <p class="criativo-kicker">Filmes</p>
          <h3>Nomeie o filme</h3>
        </div>
        <label>
          Título
          <input id="movies-title" required maxlength="120" placeholder="Ex.: Noite na cobertura" />
        </label>
        <p class="movies-hint">Formato, duração, resolução e modelo saem das Run settings.</p>
        <p class="movies-toolbar">
          <button type="submit" id="movies-create-btn">Criar storyboard</button>
          <button type="button" class="outline" id="movies-cancel">Voltar</button>
        </p>
      </form>
    `;
    composerEl.querySelector("#movies-cancel")?.addEventListener("click", () => {
      renderList();
    });
    composerEl.querySelector("#movies-create-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void createMovie();
    });
  }

  function characterPicker(
    selectedIds: string[],
    shotId?: string,
    selectedAssets = new Map<string, string>(),
  ): string {
    if (!characters.length) {
      return `<p class="movies-hint">Nenhum personagem na biblioteca. <a href="/criativo/habilidade/personagens">Criar em Personagens</a>.</p>`;
    }
    const selected = new Set(selectedIds);
    return `<div class="movies-character-picker">
      <div class="movies-cast" role="group" aria-label="Personagens no take">
        ${characters
          .map((item) => {
            const chosenAsset = item.assets?.find(
              (asset) => asset.id === selectedAssets.get(item.id) && isCharacterImage(asset),
            );
            const src = assetSrc(chosenAsset || heroOf(item));
            const active = selected.has(item.id);
            return `<button type="button" class="movies-cast-option${active ? " is-active" : ""}" data-character-id="${escapeHtml(item.id)}"${shotId ? ` data-shot-id="${escapeHtml(shotId)}"` : ""} aria-pressed="${active ? "true" : "false"}" title="Escolher imagem de ${escapeHtml(item.name)}">
              ${
                src
                  ? `<img src="${escapeHtml(src)}" alt="" draggable="false" />`
                  : `<span class="movies-cast-empty"></span>`
              }
              <span>${escapeHtml(item.name)}</span>
            </button>`;
          })
          .join("")}
      </div>
      <p class="movies-hint">Selecione um personagem para escolher a foto usada como referência neste take. Até 4 personagens.</p>
    </div>`;
  }

  function directionChips(
    options: MovieDirectionOption[],
    field: "framing" | "camera",
    selected: string,
    shotId?: string,
  ): string {
    return options
      .map((item) => {
        const active = item.id === selected;
        return `<button type="button" class="movies-direction-chip${
          active ? " is-active" : ""
        }" data-field="${field}" data-value="${escapeHtml(item.id)}" data-hint="${escapeHtml(item.hint)}"${
          shotId ? ` data-shot-id="${escapeHtml(shotId)}"` : ""
        } aria-pressed="${active ? "true" : "false"}" aria-label="${escapeHtml(item.hint)}" title="${escapeHtml(
          item.hint,
        )}">${escapeHtml(item.short)}</button>`;
      })
      .join("");
  }

  function directionHint(options: MovieDirectionOption[], selected: string): string {
    return options.find((item) => item.id === selected)?.hint || "";
  }

  function directionPicker(framing: string, camera: string, shotId?: string): string {
    const framingId = resolveMovieFramingId(framing);
    const cameraId = resolveMovieCameraId(camera);
    return `<div class="movies-direction">
      <p class="movies-take-index">Direção</p>
      <div class="movies-direction-group">
        <span class="movies-direction-label">Enquadramento</span>
        <div class="movies-direction-chips" role="group" aria-label="Enquadramento">
          ${directionChips(MOVIE_FRAMINGS, "framing", framingId, shotId)}
        </div>
        <p class="movies-direction-hint">${escapeHtml(directionHint(MOVIE_FRAMINGS, framingId))}</p>
      </div>
      <div class="movies-direction-group">
        <span class="movies-direction-label">Câmera</span>
        <div class="movies-direction-chips" role="group" aria-label="Câmera">
          ${directionChips(MOVIE_CAMERAS, "camera", cameraId, shotId)}
        </div>
        <p class="movies-direction-hint">${escapeHtml(directionHint(MOVIE_CAMERAS, cameraId))}</p>
      </div>
    </div>`;
  }

  function rememberSelectedShot(movie: CreativeMovie, preferred?: string | "new" | null) {
    const shots = movie.shots || [];
    const id = preferred ?? selectedShotId;
    if (id === "new") {
      selectedShotId = "new";
      return;
    }
    if (id && shots.some((shot) => shot.id === id)) {
      selectedShotId = id;
      return;
    }
    selectedShotId = shots[0]?.id || "new";
  }

  function statusClass(status: string): string {
    if (status === "ready") return " is-ready";
    if (status === "failed" || status === "generating") return " is-failed";
    return "";
  }

  function renderTakeList(movie: CreativeMovie): string {
    const items = (movie.shots || [])
      .map((shot, index) => {
        const clip = clipSrc(shot);
        const active = selectedShotId === shot.id;
        const cast = takeCastLabel(shot);
        return `<button type="button" class="movies-take-item${active ? " is-active" : ""}" data-select-shot="${escapeHtml(
          shot.id,
        )}" aria-pressed="${active ? "true" : "false"}">
          ${
            clip
              ? `<video src="${escapeHtml(clip)}" muted playsinline preload="metadata"></video>`
              : `<span class="movies-take-item-empty"></span>`
          }
          <span class="movies-take-item-copy">
            <span class="movies-take-item-head">
              <span class="movies-take-index">Take ${index + 1}</span>
              <span class="movies-status${statusClass(shot.status)}">${escapeHtml(statusLabel(shot.status))}</span>
            </span>
            ${cast ? `<strong>${escapeHtml(cast)}</strong>` : ""}
            <em>${escapeHtml(takePreview(shot))}</em>
          </span>
        </button>`;
      })
      .join("");
    const creating = selectedShotId === "new";
    return `<nav class="movies-take-list" aria-label="Takes">
      ${items}
      <button type="button" class="movies-take-item movies-take-item-new${creating ? " is-active" : ""}" data-select-shot="new" aria-pressed="${creating ? "true" : "false"}">
        <span class="movies-take-item-empty"></span>
        <span class="movies-take-item-copy">
          <span class="movies-take-item-head">
            <span class="movies-take-index">Novo take</span>
          </span>
          <em>Abrir o formulário para adicionar</em>
        </span>
      </button>
    </nav>`;
  }

  function renderTakeEditor(movie: CreativeMovie, shot: CreativeMovieShot, index: number): string {
    const portrait = movie.aspectRatio === "9:16";
    const clip = clipSrc(shot);
    const selectedAssets = new Map(
      (shot.cast || [])
        .filter((item) => item.assetId)
        .map((item) => [item.characterId, item.assetId as string]),
    );
    const missingHero = shotCharacters(shot).some((item) => !heroOf(item));
    return `<article class="movies-take${portrait ? " movies-take-9x16" : ""}" data-shot-card="${escapeHtml(shot.id)}">
      <div class="movies-take-head">
        <span class="movies-take-index">Take ${index + 1}</span>
        <span class="movies-status${statusClass(shot.status)}">${escapeHtml(statusLabel(shot.status))}</span>
      </div>
      ${characterPicker(shotCharacterIds(shot), shot.id, selectedAssets)}
      ${
        missingHero
          ? `<p class="movies-hint">Sem retrato na ficha — o take sai em texto. Gere o hero em Personagens para travar o rosto.</p>`
          : ""
      }
      ${clip ? `<video src="${escapeHtml(clip)}" controls playsinline></video>` : ""}
      <form class="criativo-flyer-form" data-shot-form="${escapeHtml(shot.id)}">
        <label>
          Cenário
          <textarea data-field="scene" rows="2" maxlength="4000">${escapeHtml(shot.scene)}</textarea>
        </label>
        <label>
          Ação
          <textarea data-field="action" rows="2" maxlength="4000">${escapeHtml(shot.action)}</textarea>
        </label>
        ${directionPicker(shot.framing || DEFAULT_MOVIE_FRAMING, shot.camera || DEFAULT_MOVIE_CAMERA, shot.id)}
        <label>
          Fala (opcional)
          <textarea data-field="dialogue" rows="2" maxlength="2000">${escapeHtml(shot.dialogue || "")}</textarea>
        </label>
        ${shot.error ? `<p class="movies-hint">${escapeHtml(shot.error)}</p>` : ""}
        <p class="movies-toolbar">
          <button type="button" data-generate="${escapeHtml(shot.id)}" ${
            isLockedGenerating(shot) ? "disabled" : ""
          }>${escapeHtml(generateButtonLabel(shot))}</button>
          <button type="button" class="outline danger" data-delete-shot="${escapeHtml(shot.id)}">Remover</button>
        </p>
      </form>
    </article>`;
  }

  function renderNewTakeEditor(): string {
    return `<article class="movies-take" id="movies-add-take">
      <div class="movies-take-head">
        <span class="movies-take-index">Novo take</span>
      </div>
      ${characterPicker([...newTakeAssets.keys()], undefined, newTakeAssets)}
      <form id="movies-shot-create" class="criativo-flyer-form">
        <label>
          Cenário
          <textarea id="movies-new-scene" rows="2" required maxlength="4000" placeholder="Onde acontece"></textarea>
        </label>
        <label>
          Ação
          <textarea id="movies-new-action" rows="2" required maxlength="4000" placeholder="O que o elenco faz"></textarea>
        </label>
        ${directionPicker(newTakeFraming, newTakeCamera)}
        <label>
          Fala (opcional)
          <textarea id="movies-new-dialogue" rows="2" maxlength="2000" placeholder="O que fala"></textarea>
        </label>
        <button type="submit">Adicionar take</button>
      </form>
    </article>`;
  }

  function renderBoard(movie: CreativeMovie) {
    const sameMovie = boardMovie?.id === movie.id;
    mode = "board";
    boardMovie = movie;
    if (sameMovie) rememberSelectedShot(movie);
    else selectedShotId = (movie.shots || [])[0]?.id || "new";
    nameInput.value = movie.title;
    document.title = titleForRoute(
      { name: "criativo-skill", id: MOVIES_ID, movieId: movie.id },
      movie.title,
    );
    const readyClips = (movie.shots || []).filter((shot) => shot.status === "ready" && shot.localPath);
    const selectedIndex = (movie.shots || []).findIndex((shot) => shot.id === selectedShotId);
    const selectedShot = selectedIndex >= 0 ? movie.shots![selectedIndex] : null;
    const stage = selectedShot
      ? renderTakeEditor(movie, selectedShot, selectedIndex)
      : renderNewTakeEditor();
    composerEl.innerHTML = `
      <div class="movies-workspace">
        <p class="movies-toolbar">
          <a href="/criativo/habilidade/movies" id="movies-back">← Filmes</a>
          <button type="button" class="outline" id="movies-play-all" ${
            readyClips.length ? "" : "disabled"
          }>Play all</button>
          <button type="button" class="danger" id="movies-delete">Excluir filme</button>
        </p>
        <div class="criativo-composer-copy">
          <p class="criativo-kicker">Storyboard</p>
          <h3>${escapeHtml(movie.title)}</h3>
          <p>${escapeHtml(movie.aspectRatio)} · ${escapeHtml(movie.duration)} por take</p>
        </div>
        ${
          readyClips.length
            ? `<video class="movies-player" id="movies-player" controls playsinline></video>`
            : ""
        }
        <div class="movies-board">
          ${renderTakeList(movie)}
          <div class="movies-take-stage">
            ${stage}
          </div>
        </div>
        <div class="videos-picker movies-character-modal" id="movies-character-modal" hidden>
          <div class="videos-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="movies-character-modal-title">
            <header>
              <h3 id="movies-character-modal-title">Escolha a foto do personagem</h3>
              <button type="button" data-character-modal-close>Fechar</button>
            </header>
            <p class="movies-hint" id="movies-character-modal-status"></p>
            <div class="videos-picker-grid" id="movies-character-image-grid"></div>
            <p class="movies-toolbar">
              <button type="button" class="outline danger" id="movies-character-remove" hidden>Remover personagem deste take</button>
            </p>
          </div>
        </div>
      </div>
    `;
    bindBoard(movie);
  }

  function bindBoard(movie: CreativeMovie) {
    composerEl.querySelector("#movies-back")?.addEventListener("click", (event) => {
      event.preventDefault();
      navigate({ name: "criativo-skill", id: MOVIES_ID });
    });
    composerEl.querySelector("#movies-delete")?.addEventListener("click", () => {
      void deleteMovie(movie.id);
    });
    composerEl.querySelector("#movies-play-all")?.addEventListener("click", () => {
      playAll(movie);
    });
    composerEl.querySelectorAll<HTMLButtonElement>("[data-select-shot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.selectShot;
        if (!id || id === selectedShotId) return;
        rememberSelectedShot(movie, id);
        renderBoard(movie);
      });
    });
    const player = composerEl.querySelector("#movies-player") as HTMLVideoElement | null;
    player?.addEventListener("ended", () => {
      playIndex += 1;
      if (playIndex < playList.length) player.src = playList[playIndex];
    });
    composerEl.querySelectorAll<HTMLFormElement>("[data-shot-form]").forEach((form) => {
      const shotId = form.dataset.shotForm;
      if (!shotId) return;
      form.querySelectorAll<HTMLTextAreaElement>("textarea[data-field]").forEach((field) => {
        field.addEventListener("blur", () => {
          const key = field.dataset.field;
          if (!key) return;
          void patchShot(movie.id, shotId, { [key]: field.value });
        });
      });
    });
    composerEl.querySelectorAll<HTMLButtonElement>(".movies-direction-chip").forEach((btn) => {
      const group = btn.closest(".movies-direction-group");
      const hintEl = group?.querySelector<HTMLElement>(".movies-direction-hint");
      const activeChip = () =>
        group?.querySelector<HTMLButtonElement>(".movies-direction-chip.is-active") || null;
      const paintHint = (chip?: HTMLButtonElement | null) => {
        if (hintEl) hintEl.textContent = chip?.dataset.hint || "";
      };
      btn.addEventListener("mouseenter", () => paintHint(btn));
      btn.addEventListener("focus", () => paintHint(btn));
      btn.addEventListener("mouseleave", () => paintHint(activeChip()));
      btn.addEventListener("blur", () => paintHint(activeChip()));
      btn.addEventListener("click", () => {
        const field = btn.dataset.field;
        const value = btn.dataset.value;
        if (!field || !value) return;
        const chips = btn.closest(".movies-direction-chips");
        chips?.querySelectorAll<HTMLButtonElement>(".movies-direction-chip").forEach((chip) => {
          const active = chip === btn;
          chip.classList.toggle("is-active", active);
          chip.setAttribute("aria-pressed", active ? "true" : "false");
        });
        paintHint(btn);
        const shotId = btn.dataset.shotId;
        if (!shotId) {
          if (field === "framing") newTakeFraming = value;
          if (field === "camera") newTakeCamera = value;
          return;
        }
        void patchShot(movie.id, shotId, { [field]: value });
      });
    });
    composerEl.querySelectorAll<HTMLButtonElement>("[data-generate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const shotId = btn.dataset.generate;
        if (shotId) void generateShot(movie.id, shotId);
      });
    });
    composerEl.querySelectorAll<HTMLButtonElement>("[data-delete-shot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const shotId = btn.dataset.deleteShot;
        if (shotId) void deleteShot(movie.id, shotId);
      });
    });
    composerEl.querySelector("#movies-shot-create")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void addShot(movie.id);
    });
    composerEl.querySelector("[data-character-modal-close]")?.addEventListener("click", () => {
      closeCharacterPicker();
    });
    composerEl.querySelector("#movies-character-modal")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeCharacterPicker();
    });
    composerEl.querySelector("#movies-character-image-grid")?.addEventListener("click", (event) => {
      const card = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
        "[data-character-asset]",
      );
      if (!card?.dataset.characterAsset) return;
      void selectCharacterAsset(card.dataset.characterAsset);
    });
    composerEl.querySelector("#movies-character-remove")?.addEventListener("click", () => {
      void removeCharacterFromTake();
    });
  }

  function playAll(movie: CreativeMovie) {
    playList = (movie.shots || [])
      .filter((shot) => shot.status === "ready" && shot.localPath)
      .map((shot) => clipSrc(shot));
    const player = composerEl.querySelector("#movies-player") as HTMLVideoElement | null;
    if (!player || !playList.length) return;
    playIndex = 0;
    player.src = playList[0];
    void player.play();
  }

  function closeCharacterPicker() {
    const modal = composerEl.querySelector<HTMLElement>("#movies-character-modal");
    if (modal) modal.hidden = true;
    document.body.style.overflow = "";
    pickerCharacterId = null;
    pickerShotId = null;
  }

  function openCharacterPicker(characterId: string, shotId?: string) {
    const character = characters.find((item) => item.id === characterId);
    if (!character) return;
    pickerCharacterId = characterId;
    pickerShotId = shotId || null;
    const modal = composerEl.querySelector<HTMLElement>("#movies-character-modal");
    const title = composerEl.querySelector<HTMLElement>("#movies-character-modal-title");
    const status = composerEl.querySelector<HTMLElement>("#movies-character-modal-status");
    const grid = composerEl.querySelector<HTMLElement>("#movies-character-image-grid");
    const remove = composerEl.querySelector<HTMLButtonElement>("#movies-character-remove");
    if (!modal || !title || !status || !grid || !remove) return;

    title.textContent = `Escolha a foto de ${character.name}`;
    const images = (character.assets || []).filter(isCharacterImage);
    const currentAssetId =
      (shotId
        ? boardMovie?.shots
            ?.find((shot) => shot.id === shotId)
            ?.cast?.find((item) => item.characterId === characterId)?.assetId
        : newTakeAssets.get(characterId)) || heroOf(character)?.id;
    status.textContent = images.length
      ? "A imagem escolhida será enviada ao Gemini como referência visual deste personagem neste take."
      : "Este personagem ainda não tem imagens. Gere ou envie uma foto em Personagens antes de continuar.";
    grid.innerHTML = images
      .map((asset) => {
        const src = assetSrc(asset);
        const selected = asset.id === currentAssetId;
        return `<button type="button" class="videos-picker-card movies-character-image-option${selected ? " is-active" : ""}" data-character-asset="${escapeHtml(asset.id)}" aria-pressed="${selected ? "true" : "false"}" aria-label="Usar ${escapeHtml(asset.filename || asset.kind)}">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(asset.filename || character.name)}" />
          <span>${escapeHtml(asset.filename || asset.kind)}</span>
        </button>`;
      })
      .join("");
    const alreadyInTake = shotId
      ? shotCharacterIds(
          boardMovie?.shots?.find((shot) => shot.id === shotId) || ({} as CreativeMovieShot),
        ).includes(characterId)
      : newTakeAssets.has(characterId);
    remove.hidden = !alreadyInTake;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function renderNewTakePicker() {
    const picker = composerEl.querySelector<HTMLElement>("#movies-add-take .movies-character-picker");
    if (picker) {
      picker.outerHTML = characterPicker([...newTakeAssets.keys()], undefined, newTakeAssets);
    }
  }

  async function selectCharacterAsset(assetId: string) {
    const characterId = pickerCharacterId;
    if (!characterId) return;
    if (!pickerShotId) {
      if (!newTakeAssets.has(characterId) && newTakeAssets.size >= 4) {
        setStatus("No máximo 4 personagens por take", true);
        return;
      }
      newTakeAssets.set(characterId, assetId);
      renderNewTakePicker();
      setStatus("");
      closeCharacterPicker();
      return;
    }

    const movie = boardMovie;
    const shot = movie?.shots?.find((item) => item.id === pickerShotId);
    if (!movie || !shot) return;
    const characterIds = shotCharacterIds(shot);
    if (!characterIds.includes(characterId)) {
      if (characterIds.length >= 4) {
        setStatus("No máximo 4 personagens por take", true);
        return;
      }
      characterIds.push(characterId);
    }
    const saved = await patchShot(movie.id, shot.id, {
      characterIds,
      characterAssets: { [characterId]: assetId },
    });
    if (saved) {
      setStatus("");
      closeCharacterPicker();
    }
  }

  async function removeCharacterFromTake() {
    const characterId = pickerCharacterId;
    if (!characterId) return;
    if (!pickerShotId) {
      newTakeAssets.delete(characterId);
      renderNewTakePicker();
      setStatus("");
      closeCharacterPicker();
      return;
    }
    const movie = boardMovie;
    const shot = movie?.shots?.find((item) => item.id === pickerShotId);
    if (!shot || !movie) return;
    const characterIds = shotCharacterIds(shot).filter((id) => id !== characterId);
    if (!characterIds.length) {
      setStatus("O take precisa de pelo menos um personagem", true);
      return;
    }
    const saved = await patchShot(movie.id, shot.id, { characterIds });
    if (saved) {
      setStatus("");
      closeCharacterPicker();
    }
  }

  function selectedNewCharacterIds(): string[] {
    return [...newTakeAssets.keys()];
  }

  function selectedDirectionValue(
    root: string,
    field: "framing" | "camera",
  ): string | undefined {
    const chip = composerEl.querySelector<HTMLButtonElement>(
      `${root} .movies-direction-chip[data-field="${field}"].is-active`,
    );
    return chip?.dataset.value;
  }

  async function loadMovies() {
    const res = await api("/creative/movies");
    if (!res.ok) throw new Error(await readError(res, "Falha ao listar filmes"));
    movies = (await res.json()) as CreativeMovie[];
  }

  async function loadCharacters() {
    const res = await api("/creative/characters");
    if (!res.ok) throw new Error(await readError(res, "Falha ao listar personagens"));
    characters = (await res.json()) as CreativeCharacter[];
  }

  async function loadMovie(id: string) {
    const res = await api(`/creative/movies/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await readError(res, "Filme não encontrado"));
    return (await res.json()) as CreativeMovie;
  }

  async function createMovie() {
    if (busy) return;
    const title = (composerEl.querySelector("#movies-title") as HTMLInputElement | null)
      ?.value.trim();
    if (!title) {
      setStatus("Informe o título", true);
      return;
    }
    busy = true;
    setStatus("Criando o filme…");
    try {
      const res = await api("/creative/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, ...videoRunSettingsPayload() }),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao criar filme"));
      const created = (await res.json()) as CreativeMovie;
      navigate({ name: "criativo-skill", id: MOVIES_ID, movieId: created.id });
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao criar filme"), true);
    } finally {
      busy = false;
    }
  }

  async function addShot(movieId: string) {
    if (busy) return;
    const characterIds = selectedNewCharacterIds();
    const scene = (
      composerEl.querySelector("#movies-new-scene") as HTMLTextAreaElement | null
    )?.value.trim();
    const action = (
      composerEl.querySelector("#movies-new-action") as HTMLTextAreaElement | null
    )?.value.trim();
    const dialogue = (
      composerEl.querySelector("#movies-new-dialogue") as HTMLTextAreaElement | null
    )?.value.trim();
    const framing = selectedDirectionValue("#movies-shot-create", "framing") || newTakeFraming;
    const camera = selectedDirectionValue("#movies-shot-create", "camera") || newTakeCamera;
    if (!characterIds.length) {
      setStatus("Crie um personagem antes de montar o take", true);
      return;
    }
    if (!scene || !action) {
      setStatus("Informe cenário e ação", true);
      return;
    }
    busy = true;
    setStatus("Adicionando take…");
    try {
      const res = await api(`/creative/movies/${encodeURIComponent(movieId)}/shots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterIds,
          characterAssets: Object.fromEntries(newTakeAssets),
          scene,
          action,
          dialogue: dialogue || undefined,
          framing,
          camera,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao adicionar take"));
      const next = (await res.json()) as CreativeMovie;
      newTakeAssets = new Map();
      newTakeFraming = DEFAULT_MOVIE_FRAMING;
      newTakeCamera = DEFAULT_MOVIE_CAMERA;
      selectedShotId = next.shots?.[next.shots.length - 1]?.id || "new";
      setStatus("");
      renderBoard(next);
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao adicionar take"), true);
    } finally {
      busy = false;
    }
  }

  async function patchShot(
    movieId: string,
    shotId: string,
    body: Record<string, unknown>,
  ): Promise<CreativeMovie | undefined> {
    if (busy) return undefined;
    const res = await api(
      `/creative/movies/${encodeURIComponent(movieId)}/shots/${encodeURIComponent(shotId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      setStatus(await readError(res, "Falha ao salvar take"), true);
      return undefined;
    }
    const next = (await res.json()) as CreativeMovie;
    movies = movies.map((item) => (item.id === movieId ? next : item));
    if ("characterIds" in body || "characterId" in body || "characterAssets" in body) {
      renderBoard(next);
    }
    return next;
  }

  async function generateShot(movieId: string, shotId: string) {
    if (busy) return;
    const form = composerEl.querySelector(`[data-shot-form="${shotId}"]`);
    const scene = (form?.querySelector('[data-field="scene"]') as HTMLTextAreaElement | null)
      ?.value;
    const action = (form?.querySelector('[data-field="action"]') as HTMLTextAreaElement | null)
      ?.value;
    const dialogue = (
      form?.querySelector('[data-field="dialogue"]') as HTMLTextAreaElement | null
    )?.value;
    const framing = selectedDirectionValue(`[data-shot-form="${shotId}"]`, "framing");
    const camera = selectedDirectionValue(`[data-shot-form="${shotId}"]`, "camera");
    busy = true;
    setStatus("Gerando take…");
    try {
      await api(
        `/creative/movies/${encodeURIComponent(movieId)}/shots/${encodeURIComponent(shotId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene, action, dialogue, framing, camera }),
        },
      );
      const res = await api(
        `/creative/movies/${encodeURIComponent(movieId)}/shots/${encodeURIComponent(shotId)}/generate`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(videoRunSettingsPayload()) },
      );
      if (!res.ok) throw new Error(await readError(res, "Falha ao gerar take"));
      const next = (await res.json()) as CreativeMovie;
      setStatus("");
      renderBoard(next);
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao gerar take"), true);
      try {
        const latest = await loadMovie(movieId);
        renderBoard(latest);
      } catch {
        // keep current board
      }
    } finally {
      busy = false;
    }
  }

  async function deleteShot(movieId: string, shotId: string) {
    if (busy) return;
    busy = true;
    setStatus("Removendo take…");
    try {
      const res = await api(
        `/creative/movies/${encodeURIComponent(movieId)}/shots/${encodeURIComponent(shotId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(await readError(res, "Falha ao remover take"));
      const next = (await res.json()) as CreativeMovie;
      if (selectedShotId === shotId) {
        selectedShotId = next.shots?.[0]?.id || "new";
      }
      setStatus("");
      renderBoard(next);
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao remover take"), true);
    } finally {
      busy = false;
    }
  }

  async function deleteMovie(id: string) {
    if (busy) return;
    busy = true;
    setStatus("Excluindo filme…");
    try {
      const res = await api(`/creative/movies/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao excluir"));
      navigate({ name: "criativo-skill", id: MOVIES_ID });
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao excluir filme"), true);
    } finally {
      busy = false;
    }
  }

  composerEl.addEventListener("click", (event) => {
    if (mode !== "board") return;
    const btn = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      ".movies-cast-option",
    );
    if (!btn || !composerEl.contains(btn)) return;
    if (btn.closest("#movies-character-modal")) return;
    const characterId = btn.dataset.characterId;
    if (!characterId) return;
    event.preventDefault();
    openCharacterPicker(characterId, btn.dataset.shotId);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const modal = composerEl.querySelector<HTMLElement>("#movies-character-modal");
    if (!modal || modal.hidden) return;
    closeCharacterPicker();
  });

  function onRoute(route: AppRoute) {
    if (route.name !== "criativo-skill" || route.id !== MOVIES_ID) return;
    const seq = ++routeSeq;
    setStatus("");
    if (route.movieId) {
      const cached = movies.find((item) => item.id === route.movieId);
      if (cached) renderBoard(cached);
      void Promise.all([loadMovie(route.movieId), loadCharacters()])
        .then(([movie]) => {
          if (seq !== routeSeq) return;
          renderBoard(movie);
        })
        .catch((error) => {
          if (seq !== routeSeq) return;
          setStatus(errorMessage(error, "Filme não encontrado"), true);
          if (!cached) renderList();
        });
      return;
    }
    if (mode === "create") {
      renderCreate();
      return;
    }
    void Promise.all([loadMovies(), loadCharacters()])
      .then(() => {
        if (seq !== routeSeq) return;
        renderList();
      })
      .catch((error) => {
        if (seq !== routeSeq) return;
        setStatus(errorMessage(error, "Falha ao listar filmes"), true);
        renderList();
      });
  }

  return { onRoute };
}
