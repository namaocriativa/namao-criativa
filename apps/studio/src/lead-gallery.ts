import type { Lead, LeadImage } from "./types";
import { api } from "./api";
import { entityKindOf, profileApi } from "./profile-api";

type GalleryHandlers = {
  onLeadUpdated: (lead: Lead) => void;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imageSrc(img: LeadImage): string {
  const path = img.localPath.replace(/^\/+/, "");
  return `/${path}`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function initLeadGallery(
  host: HTMLElement,
  handlers: GalleryHandlers,
): {
  open: (lead: Lead) => void;
  close: () => void;
  sync: (lead: Lead) => void;
} {
  let lead: Lead | null = null;
  let busy = false;

  host.innerHTML = `
    <div class="site-wizard-modal lead-gallery-modal" hidden>
      <button
        type="button"
        class="site-wizard-modal__backdrop"
        data-gallery-close
        aria-label="Fechar galeria"
      ></button>
      <div
        class="site-wizard-modal__dialog lead-gallery-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-gallery-title"
      >
        <header class="site-wizard-modal__header">
          <h3 id="lead-gallery-title">Galeria</h3>
          <button type="button" class="outline" data-gallery-close>Fechar</button>
        </header>
        <p class="lead-gallery-meta" data-gallery-meta></p>
        <div class="lead-gallery-toolbar">
          <label class="lead-gallery-upload">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              data-gallery-input
            />
            Adicionar imagens
          </label>
          <p class="status" data-gallery-status></p>
        </div>
        <div class="lead-gallery-drop" data-gallery-drop>
          <ul class="lead-gallery-grid" data-gallery-grid></ul>
          <p class="lead-gallery-empty" data-gallery-empty hidden>
            Nenhuma imagem ainda. Arraste arquivos aqui ou use Adicionar imagens.
          </p>
        </div>
      </div>
    </div>
  `;

  const modal = host.querySelector<HTMLElement>(".lead-gallery-modal")!;
  const grid = host.querySelector<HTMLElement>("[data-gallery-grid]")!;
  const empty = host.querySelector<HTMLElement>("[data-gallery-empty]")!;
  const meta = host.querySelector<HTMLElement>("[data-gallery-meta]")!;
  const status = host.querySelector<HTMLElement>("[data-gallery-status]")!;
  const input = host.querySelector<HTMLInputElement>("[data-gallery-input]")!;
  const drop = host.querySelector<HTMLElement>("[data-gallery-drop]")!;

  function setStatus(message: string, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function renderGrid() {
    const images = lead?.images || [];
    const name = lead?.name || "Lead";
    meta.textContent = `${name} · ${images.length} imagem(ns)`;
    empty.hidden = images.length > 0;
    grid.innerHTML = images
      .map((img) => {
        const src = escapeHtml(imageSrc(img));
        const title = escapeHtml(img.filename || img.source || "Imagem");
        const id = escapeHtml(img.id || "");
        return `<li>
          <figure>
            <img src="${src}" alt="${title}" loading="lazy" />
            <figcaption>${title}</figcaption>
          </figure>
          <button type="button" class="danger" data-delete-image="${id}" ${
            img.id ? "" : "disabled"
          }>Excluir</button>
        </li>`;
      })
      .join("");
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    setStatus("");
  }

  function open(next: Lead) {
    lead = next;
    renderGrid();
    setStatus("");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function sync(next: Lead) {
    lead = next;
    if (!modal.hidden) renderGrid();
  }

  async function uploadFiles(files: FileList | File[]) {
    if (!lead?.id || busy) return;
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!list.length) {
      setStatus("Selecione imagens JPG, PNG, WEBP ou GIF.", true);
      return;
    }
    busy = true;
    setStatus(`Enviando ${list.length} arquivo(s)…`);
    try {
      const body = new FormData();
      for (const file of list) body.append("files", file);
      const res = await api(
        `${profileApi(entityKindOf(lead), lead.id, "/images")}`,
        { method: "POST", body },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = Array.isArray((data as { message?: unknown }).message)
          ? ((data as { message: string[] }).message).join(" ")
          : (data as { message?: string }).message;
        throw new Error(message || "Falha ao enviar imagens");
      }
      lead = data as Lead;
      handlers.onLeadUpdated(lead);
      setStatus("Imagens adicionadas.");
    } catch (error) {
      setStatus(errorMessage(error, "Erro ao enviar imagens"), true);
    } finally {
      busy = false;
      input.value = "";
    }
  }

  async function deleteImage(imageId: string) {
    if (!lead?.id || busy || !imageId) return;
    const img = (lead.images || []).find((item) => item.id === imageId);
    const label = img?.filename || "esta imagem";
    if (!window.confirm(`Excluir ${label}?`)) return;
    busy = true;
    setStatus("Excluindo…");
    try {
      const res = await api(
        `${profileApi(entityKindOf(lead), lead.id, `/images/${encodeURIComponent(imageId)}`)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { message?: string }).message || "Falha ao excluir imagem",
        );
      }
      lead = data as Lead;
      handlers.onLeadUpdated(lead);
      setStatus("Imagem excluída.");
    } catch (error) {
      setStatus(errorMessage(error, "Erro ao excluir imagem"), true);
    } finally {
      busy = false;
    }
  }

  host.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("[data-gallery-close]")) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    const del = target.closest<HTMLElement>("[data-delete-image]");
    if (del?.dataset.deleteImage) {
      void deleteImage(del.dataset.deleteImage);
    }
  });

  input.addEventListener("change", () => {
    if (input.files?.length) void uploadFiles(input.files);
  });

  drop.addEventListener("dragover", (event) => {
    event.preventDefault();
    drop.classList.add("is-dragover");
  });
  drop.addEventListener("dragleave", () => {
    drop.classList.remove("is-dragover");
  });
  drop.addEventListener("drop", (event) => {
    event.preventDefault();
    drop.classList.remove("is-dragover");
    if (event.dataTransfer?.files.length) {
      void uploadFiles(event.dataTransfer.files);
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || modal.hidden) return;
    event.preventDefault();
    close();
  });

  return { open, close, sync };
}
