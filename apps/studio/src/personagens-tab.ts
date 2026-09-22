import { api } from "./api";
import { PERSONAGENS_ID } from "./creative/features";
import { navigate, titleForRoute, type AppRoute } from "./router";
import { canAccessVideos } from "./session";
import type { CreativeCharacter, CreativeCharacterAsset } from "./types";

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

function isVideoAsset(asset: CreativeCharacterAsset): boolean {
  return (
    asset.kind === "video" ||
    (asset.mimeType || "").startsWith("video/")
  );
}

function heroOf(character: CreativeCharacter): CreativeCharacterAsset | undefined {
  const assets = character.assets || [];
  return (
    [...assets].reverse().find((item) => item.kind === "sheet") ||
    [...assets].reverse().find((item) => item.kind === "photo") ||
    [...assets].reverse().find((item) => item.kind === "upload" && !isVideoAsset(item))
  );
}

export function initPersonagensTab(): {
  onRoute: (route: AppRoute) => void;
} {
  const composerEl = requireEl<HTMLElement>("imagens-skill-form");
  const statusEl = requireEl<HTMLElement>("imagens-skill-status");
  const nameInput = requireEl<HTMLInputElement>("imagens-project-name");

  let items: CreativeCharacter[] = [];
  let busy = false;
  let mode: "list" | "create" | "detail" = "list";
  let routeSeq = 0;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function renderList() {
    mode = "list";
    nameInput.value = "Personagens";
    const cards = items
      .map((item) => {
        const hero = heroOf(item);
        const src = assetSrc(hero);
        const count = (item.assets || []).length;
        return `<a class="personagens-card" data-character-id="${escapeHtml(item.id)}" href="${escapeHtml(
          `/criativo/habilidade/personagens/${encodeURIComponent(item.id)}`,
        )}">
          ${
            src
              ? `<img src="${escapeHtml(src)}" alt="" />`
              : `<span class="personagens-card-empty">Sem retrato</span>`
          }
          <strong>${escapeHtml(item.name)}</strong>
          <em>${count} mídia${count === 1 ? "" : "s"}</em>
        </a>`;
      })
      .join("");
    composerEl.innerHTML = `
      <div class="personagens-workspace">
        <div class="criativo-composer-copy">
          <p class="criativo-kicker">Personagens</p>
          <h3>Identidades para foto, vídeo e história</h3>
        </div>
        <p class="personagens-toolbar">
          <button type="button" id="personagens-new">Novo personagem</button>
        </p>
        <div class="personagens-grid">
          ${cards || `<p class="criativo-empty">Nenhum personagem ainda. Crie o primeiro para travar uma identidade.</p>`}
        </div>
      </div>
    `;
    composerEl.querySelector("#personagens-new")?.addEventListener("click", () => {
      renderCreate();
    });
    composerEl.querySelectorAll<HTMLAnchorElement>("[data-character-id]").forEach((card) => {
      card.addEventListener("click", (event) => {
        event.preventDefault();
        const id = card.dataset.characterId;
        if (!id) return;
        const cached = items.find((item) => item.id === id);
        if (cached) renderDetail(cached);
        navigate({ name: "criativo-skill", id: PERSONAGENS_ID, characterId: id });
      });
    });
  }

  function renderCreate() {
    mode = "create";
    nameInput.value = "Novo personagem";
    composerEl.innerHTML = `
      <form id="personagens-create-form" class="criativo-flyer-form">
        <div class="criativo-composer-copy">
          <p class="criativo-kicker">Personagens</p>
          <h3>Descreva a identidade</h3>
        </div>
        <label>
          Nome
          <input id="personagens-name" required maxlength="120" placeholder="Ex.: Luma" />
        </label>
        <label>
          Aparência
          <textarea id="personagens-appearance" rows="5" required maxlength="4000" placeholder="Rosto, idade, cabelo, corpo, figurino-assinatura"></textarea>
        </label>
        <label>
          Personalidade (opcional)
          <textarea id="personagens-personality" rows="3" maxlength="4000" placeholder="Presença, jeito, energia"></textarea>
        </label>
        <label>
          Fotos de referência (opcional)
          <input id="personagens-files" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple />
        </label>
        <p class="personagens-toolbar">
          <button type="submit" id="personagens-create-btn">Criar e gerar retrato</button>
          <button type="button" class="outline" id="personagens-cancel">Voltar</button>
        </p>
      </form>
    `;
    composerEl.querySelector("#personagens-cancel")?.addEventListener("click", () => {
      renderList();
    });
    composerEl.querySelector("#personagens-create-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void createCharacter();
    });
  }

  function renderDetail(character: CreativeCharacter) {
    mode = "detail";
    nameInput.value = character.name;
    document.title = titleForRoute(
      { name: "criativo-skill", id: PERSONAGENS_ID, characterId: character.id },
      character.name,
    );
    const assets = character.assets || [];
    const gallery = assets
      .map((asset) => {
        const src = assetSrc(asset);
        if (!src) return "";
        if (isVideoAsset(asset)) {
          return `<figure class="personagens-media">
            <video src="${escapeHtml(src)}" controls playsinline></video>
          </figure>`;
        }
        return `<figure class="personagens-media">
          <a href="${escapeHtml(src)}" target="_blank" rel="noreferrer">
            <img src="${escapeHtml(src)}" alt="" />
          </a>
        </figure>`;
      })
      .join("");
    const videoComposer = canAccessVideos()
      ? `<form id="personagens-video-form" class="criativo-flyer-form personagens-composer">
          <p class="criativo-field-label">Novo vídeo</p>
          <label>
            Ação
            <textarea id="personagens-video-prompt" rows="3" placeholder="Ex.: acena, respira e olha para a câmera"></textarea>
          </label>
          <button type="submit">Gerar vídeo</button>
        </form>`
      : "";
    composerEl.innerHTML = `
      <div class="personagens-workspace">
        <p class="personagens-toolbar">
          <a href="/criativo/habilidade/personagens" id="personagens-back">← Biblioteca</a>
          <button type="button" class="danger" id="personagens-delete">Excluir</button>
        </p>
        <div class="criativo-composer-copy">
          <p class="criativo-kicker">Ficha</p>
          <h3>${escapeHtml(character.name)}</h3>
          <p>${escapeHtml(character.appearance)}</p>
          ${
            character.personality
              ? `<p class="personagens-personality">${escapeHtml(character.personality)}</p>`
              : ""
          }
        </div>
        <div class="personagens-gallery">
          ${gallery || `<p class="criativo-empty">Ainda sem mídias. Gere o retrato abaixo.</p>`}
        </div>
        <form id="personagens-photo-form" class="criativo-flyer-form personagens-composer">
          <p class="criativo-field-label">Nova foto</p>
          <label>
            Cena ou ângulo
            <textarea id="personagens-photo-prompt" rows="3" placeholder="Vazio gera o retrato-mestre da ficha"></textarea>
          </label>
          <button type="submit">Gerar foto</button>
        </form>
        ${videoComposer}
      </div>
    `;
    composerEl.querySelector("#personagens-back")?.addEventListener("click", (event) => {
      event.preventDefault();
      navigate({ name: "criativo-skill", id: PERSONAGENS_ID });
    });
    composerEl.querySelector("#personagens-delete")?.addEventListener("click", () => {
      void deleteCharacter(character.id);
    });
    composerEl.querySelector("#personagens-photo-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void generatePhoto(character.id);
    });
    composerEl.querySelector("#personagens-video-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      void generateVideo(character.id);
    });
  }

  async function loadList() {
    const res = await api("/creative/characters");
    if (!res.ok) throw new Error(await readError(res, "Falha ao listar personagens"));
    items = (await res.json()) as CreativeCharacter[];
  }

  async function loadCharacter(id: string) {
    const res = await api(`/creative/characters/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(await readError(res, "Personagem não encontrado"));
    return (await res.json()) as CreativeCharacter;
  }

  async function createCharacter() {
    if (busy) return;
    const name = (composerEl.querySelector("#personagens-name") as HTMLInputElement | null)
      ?.value.trim();
    const appearance = (
      composerEl.querySelector("#personagens-appearance") as HTMLTextAreaElement | null
    )?.value.trim();
    const personality = (
      composerEl.querySelector("#personagens-personality") as HTMLTextAreaElement | null
    )?.value.trim();
    const files = (composerEl.querySelector("#personagens-files") as HTMLInputElement | null)
      ?.files;
    if (!name || !appearance) {
      setStatus("Informe nome e aparência", true);
      return;
    }
    busy = true;
    const btn = composerEl.querySelector("#personagens-create-btn") as HTMLButtonElement | null;
    if (btn) btn.disabled = true;
    setStatus("Criando o personagem e gerando o retrato…");
    try {
      const body = new FormData();
      body.set("name", name);
      body.set("appearance", appearance);
      if (personality) body.set("personality", personality);
      body.set("generatePortrait", "true");
      if (files) {
        for (const file of Array.from(files).slice(0, 8)) body.append("files", file);
      }
      const res = await api("/creative/characters", { method: "POST", body });
      if (!res.ok) throw new Error(await readError(res, "Falha ao criar personagem"));
      const created = (await res.json()) as CreativeCharacter;
      navigate({
        name: "criativo-skill",
        id: PERSONAGENS_ID,
        characterId: created.id,
      });
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao criar personagem"), true);
    } finally {
      busy = false;
      if (btn) btn.disabled = false;
    }
  }

  async function generatePhoto(id: string) {
    if (busy) return;
    const prompt = (
      composerEl.querySelector("#personagens-photo-prompt") as HTMLTextAreaElement | null
    )?.value.trim();
    busy = true;
    setStatus("Gerando foto do personagem…");
    try {
      const res = await api(`/creative/characters/${encodeURIComponent(id)}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt ? { prompt } : {}),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao gerar foto"));
      const next = (await res.json()) as CreativeCharacter;
      setStatus("");
      renderDetail(next);
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao gerar foto"), true);
    } finally {
      busy = false;
    }
  }

  async function generateVideo(id: string) {
    if (busy) return;
    const prompt = (
      composerEl.querySelector("#personagens-video-prompt") as HTMLTextAreaElement | null
    )?.value.trim();
    busy = true;
    setStatus("Gerando vídeo do personagem…");
    try {
      const res = await api(`/creative/characters/${encodeURIComponent(id)}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompt ? { prompt } : {}),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao gerar vídeo"));
      const next = (await res.json()) as CreativeCharacter;
      setStatus("");
      renderDetail(next);
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao gerar vídeo"), true);
    } finally {
      busy = false;
    }
  }

  async function deleteCharacter(id: string) {
    if (busy) return;
    busy = true;
    setStatus("Excluindo personagem…");
    try {
      const res = await api(`/creative/characters/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao excluir"));
      navigate({ name: "criativo-skill", id: PERSONAGENS_ID });
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao excluir personagem"), true);
    } finally {
      busy = false;
    }
  }

  function onRoute(route: AppRoute) {
    if (route.name !== "criativo-skill" || route.id !== PERSONAGENS_ID) return;
    const seq = ++routeSeq;
    setStatus("");
    if (route.characterId) {
      const cached = items.find((item) => item.id === route.characterId);
      if (cached) renderDetail(cached);
      void loadCharacter(route.characterId)
        .then((character) => {
          if (seq !== routeSeq) return;
          renderDetail(character);
        })
        .catch((error) => {
          if (seq !== routeSeq) return;
          setStatus(errorMessage(error, "Personagem não encontrado"), true);
          if (!cached) renderList();
        });
      return;
    }
    if (mode === "create") {
      renderCreate();
      return;
    }
    void loadList()
      .then(() => {
        if (seq !== routeSeq) return;
        renderList();
      })
      .catch((error) => {
        if (seq !== routeSeq) return;
        setStatus(errorMessage(error, "Falha ao listar personagens"), true);
        renderList();
      });
  }

  return { onRoute };
}
