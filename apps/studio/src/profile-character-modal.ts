import { api } from "./api";
import { PERSONAGENS_ID } from "./creative/features";
import { entityKindOf, profileApi, type EntityKind } from "./profile-api";
import type { CreativeCharacter, CreativeCharacterAsset, Lead } from "./types";

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

function assetSrc(path: string | undefined): string {
  if (!path) return "";
  return `/${path.replace(/^\/+/, "")}`;
}

function isCharacterImage(asset: CreativeCharacterAsset): boolean {
  return asset.kind !== "video" && !String(asset.mimeType || "").startsWith("video/");
}

function characterHero(character: CreativeCharacter | undefined): CreativeCharacterAsset | undefined {
  const assets = (character?.assets || []).filter(isCharacterImage);
  return (
    [...assets].reverse().find((item) => item.kind === "sheet") ||
    [...assets].reverse().find((item) => item.kind === "photo") ||
    [...assets].reverse().find((item) => item.kind === "upload")
  );
}

type LinkedCharacterResponse = {
  characterId: string | null;
  character: CreativeCharacter | null;
};

export function initProfileCharacterModal(
  host: HTMLElement,
): {
  open: (lead: Lead) => void;
  close: () => void;
} {
  let lead: Lead | null = null;
  let kind: EntityKind = "lead";
  let busy = false;
  let characters: CreativeCharacter[] = [];
  let selectedId = "";

  host.innerHTML = `
    <div class="site-wizard-modal profile-character-modal" hidden>
      <button type="button" class="site-wizard-modal__backdrop" data-pc-close aria-label="Fechar"></button>
      <div class="site-wizard-modal__dialog profile-character-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="profile-character-title">
        <header class="site-wizard-modal__header">
          <div>
            <p class="site-wizard-modal__kicker">Perfil</p>
            <h3 id="profile-character-title">Personagem</h3>
          </div>
          <button type="button" class="outline" data-pc-close>Fechar</button>
        </header>
        <p class="lead-share-hint">Associe um personagem da biblioteca a este perfil. No produce do planejamento a escolha continua manual.</p>
        <div class="profile-character-body" data-pc-list></div>
        <footer class="brand-identity-footer">
          <p class="status" data-pc-status></p>
          <div class="actions">
            <button type="button" class="outline danger" data-pc-clear hidden>Remover vínculo</button>
            <button type="button" class="outline" data-pc-close>Cancelar</button>
            <button type="button" data-pc-save>Salvar</button>
          </div>
        </footer>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".profile-character-modal")!;
  const status = host.querySelector<HTMLElement>("[data-pc-status]")!;
  const list = host.querySelector<HTMLElement>("[data-pc-list]")!;
  const clearBtn = host.querySelector<HTMLButtonElement>("[data-pc-clear]")!;
  const saveBtn = host.querySelector<HTMLButtonElement>("[data-pc-save]")!;

  function setStatus(message: string, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function close() {
    modal.hidden = true;
    lead = null;
    busy = false;
    setStatus("");
  }

  function renderList() {
    clearBtn.hidden = !selectedId;
    if (!characters.length) {
      list.innerHTML = `<p class="movies-hint">Nenhum personagem na biblioteca. <a href="/criativo/habilidade/${PERSONAGENS_ID}">Criar em Personagens</a>.</p>`;
      return;
    }
    list.innerHTML = `<div class="movies-cast profile-character-cast" role="listbox" aria-label="Personagem do perfil">
      ${characters
        .map((item) => {
          const hero = characterHero(item);
          const src = assetSrc(hero?.localPath);
          const selected = item.id === selectedId;
          return `<button type="button" class="movies-cast-option${selected ? " is-active" : ""}" data-pc-character="${escapeHtml(item.id)}" aria-pressed="${selected ? "true" : "false"}">
            ${src ? `<img src="${escapeHtml(src)}" alt="" />` : `<span class="movies-cast-empty"></span>`}
            <span>${escapeHtml(item.name)}</span>
          </button>`;
        })
        .join("")}
    </div>`;
    list.querySelectorAll<HTMLButtonElement>("[data-pc-character]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedId = btn.dataset.pcCharacter || "";
        renderList();
      });
    });
  }

  async function open(next: Lead) {
    lead = next;
    kind = entityKindOf(next);
    busy = false;
    selectedId = "";
    characters = [];
    setStatus("Carregando…");
    modal.hidden = false;
    renderList();
    try {
      const [linkedRes, listRes] = await Promise.all([
        api(profileApi(kind, next.id, "/character")),
        api("/creative/characters"),
      ]);
      if (!listRes.ok) throw new Error(await readError(listRes, "Falha ao listar personagens"));
      characters = (await listRes.json()) as CreativeCharacter[];
      if (linkedRes.ok) {
        const linked = (await linkedRes.json()) as LinkedCharacterResponse;
        selectedId = linked.characterId || "";
      }
      setStatus("");
      renderList();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao abrir personagem"), true);
      renderList();
    }
  }

  async function save() {
    if (!lead || busy) return;
    busy = true;
    saveBtn.disabled = true;
    setStatus("Salvando…");
    try {
      const res = await api(profileApi(kind, lead.id, "/character"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: selectedId || null }),
      });
      if (!res.ok) throw new Error(await readError(res, "Falha ao salvar"));
      setStatus(selectedId ? "Personagem vinculado" : "Vínculo removido");
      close();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao salvar"), true);
    } finally {
      busy = false;
      saveBtn.disabled = false;
    }
  }

  host.querySelectorAll("[data-pc-close]").forEach((node) => {
    node.addEventListener("click", () => close());
  });
  clearBtn.addEventListener("click", () => {
    selectedId = "";
    renderList();
  });
  saveBtn.addEventListener("click", () => {
    void save();
  });

  return { open, close };
}
