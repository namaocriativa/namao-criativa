import { api } from "./api";
import {
  creativeKindFromRoute,
  renderCreativeKinds,
} from "./creative-kinds";
import { currentRoute, hrefFor, type AppRoute } from "./router";
import { canAccessImages, canAccessVideos } from "./session";
import type { ImageLibraryProject, VideoLibraryProject } from "./types";

type MediaKind = "image" | "video";
type FilterKind = "all" | MediaKind;
type GroupMode = "recent" | "conversation";

type GalleryItem = {
  id: string;
  kind: MediaKind;
  projectId: string;
  projectName: string;
  assetId: string;
  filename: string;
  src: string;
  createdAt: number;
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

function assetSrc(asset: { localPath?: string } | undefined): string {
  if (!asset?.localPath) return "";
  return `/${asset.localPath.replace(/^\/+/, "")}`;
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

function formatDate(value?: number): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function itemId(kind: MediaKind, projectId: string, assetId: string): string {
  return `${kind}:${projectId}:${assetId}`;
}

function flatten(
  kind: MediaKind,
  projects: Array<{
    id: string;
    name: string;
    assets?: Array<{
      id: string;
      filename?: string;
      localPath: string;
      createdAt?: string;
    }>;
  }>,
): GalleryItem[] {
  return projects.flatMap((project) =>
    (project.assets || []).flatMap((asset) => {
      const src = assetSrc(asset);
      if (!src) return [];
      return [
        {
          id: itemId(kind, project.id, asset.id),
          kind,
          projectId: project.id,
          projectName: project.name || "Conversa",
          assetId: asset.id,
          filename: asset.filename || (kind === "image" ? "Imagem" : "Vídeo"),
          src,
          createdAt: asset.createdAt ? Date.parse(asset.createdAt) : 0,
        } satisfies GalleryItem,
      ];
    }),
  );
}

function conversationHref(item: GalleryItem): string {
  return hrefFor(
    item.kind === "image"
      ? { name: "imagens-project", id: item.projectId }
      : { name: "videos-project", id: item.projectId },
  );
}

export function initCriativoGallery(): {
  onRoute: (route: AppRoute) => void;
} {
  const kindsEl = requireEl<HTMLElement>("gallery-studio-kinds");
  const statusEl = requireEl<HTMLElement>("gallery-status");
  const groupsEl = requireEl<HTMLElement>("gallery-groups");
  const emptyEl = requireEl<HTMLElement>("gallery-empty");
  const searchEl = requireEl<HTMLInputElement>("gallery-search");
  const lightbox = requireEl<HTMLElement>("gallery-lightbox");
  const lightboxTitle = requireEl<HTMLElement>("gallery-lightbox-title");
  const lightboxMedia = requireEl<HTMLElement>("gallery-lightbox-media");
  const lightboxActions = requireEl<HTMLElement>("gallery-lightbox-actions");
  const typeSwitch = requireEl<HTMLElement>("gallery-type-switch");
  const groupSwitch = requireEl<HTMLElement>("gallery-group-switch");

  let items: GalleryItem[] = [];
  let filter: FilterKind = "all";
  let groupMode: GroupMode = "recent";
  let query = "";
  let busy = false;
  let lightboxId: string | null = null;

  function setStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function visibleItems(): GalleryItem[] {
    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => (filter === "all" ? true : item.kind === filter))
      .filter((item) =>
        needle ? item.projectName.toLowerCase().includes(needle) : true,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function renderTypeSwitch() {
    const imageOk = canAccessImages();
    const videoOk = canAccessVideos();
    const buttons: Array<{ id: FilterKind; label: string; show: boolean }> = [
      { id: "all", label: "Todas", show: imageOk && videoOk },
      { id: "image", label: "Imagens", show: imageOk },
      { id: "video", label: "Vídeos", show: videoOk },
    ];
    const shown = buttons.filter((btn) => btn.show);
    if (shown.length <= 1) {
      typeSwitch.hidden = true;
      return;
    }
    typeSwitch.hidden = false;
    typeSwitch.innerHTML = shown
      .map(
        (btn) =>
          `<button type="button" data-gallery-filter="${btn.id}" class="${filter === btn.id ? "active" : ""}">${btn.label}</button>`,
      )
      .join("");
  }

  function renderGroupSwitch() {
    groupSwitch.innerHTML = [
      ["recent", "Recentes"],
      ["conversation", "Por conversa"],
    ]
      .map(
        ([id, label]) =>
          `<button type="button" data-gallery-group="${id}" class="${groupMode === id ? "active" : ""}">${label}</button>`,
      )
      .join("");
  }

  function cardHtml(item: GalleryItem): string {
    const media =
      item.kind === "video"
        ? `<video src="${escapeHtml(item.src)}" muted playsinline preload="metadata"></video>`
        : `<img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.filename)}" />`;
    return `<li>
      <button type="button" class="criativo-gallery-thumb" data-gallery-open="${escapeHtml(item.id)}">
        ${media}
        <span>${item.kind === "video" ? "Vídeo" : "Imagem"}</span>
      </button>
      <p class="criativo-gallery-meta">
        <strong>${escapeHtml(item.projectName)}</strong>
        <em>${escapeHtml(formatDate(item.createdAt))}</em>
      </p>
      <div class="imagens-gallery-actions">
        <a class="button-link outline" href="${escapeHtml(conversationHref(item))}">Abrir</a>
        <a class="button-link outline" href="${escapeHtml(item.src)}" download="${escapeHtml(item.filename)}">Baixar</a>
        <button type="button" class="danger" data-gallery-delete="${escapeHtml(item.id)}">Excluir</button>
      </div>
    </li>`;
  }

  function renderGrid() {
    const list = visibleItems();
    emptyEl.hidden = list.length > 0;
    if (!list.length) {
      groupsEl.innerHTML = "";
      emptyEl.textContent = items.length
        ? "Nenhuma mídia combina com o filtro."
        : "Nenhuma mídia gerada ainda.";
      return;
    }

    if (groupMode === "recent") {
      groupsEl.innerHTML = `<ul class="imagens-gallery-grid">${list.map(cardHtml).join("")}</ul>`;
      return;
    }

    const groups = new Map<string, GalleryItem[]>();
    for (const item of list) {
      const key = `${item.kind}:${item.projectId}`;
      const bucket = groups.get(key) || [];
      bucket.push(item);
      groups.set(key, bucket);
    }
    groupsEl.innerHTML = [...groups.values()]
      .map((group) => {
        const first = group[0];
        return `<section class="criativo-gallery-group">
          <header>
            <h3>${escapeHtml(first.projectName)}</h3>
            <a href="${escapeHtml(conversationHref(first))}">Abrir conversa</a>
          </header>
          <ul class="imagens-gallery-grid">${group.map(cardHtml).join("")}</ul>
        </section>`;
      })
      .join("");
  }

  function closeLightbox() {
    lightboxId = null;
    lightbox.hidden = true;
    lightboxMedia.innerHTML = "";
    lightboxActions.innerHTML = "";
    lightboxTitle.textContent = "";
  }

  function openLightbox(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    lightboxId = id;
    lightbox.hidden = false;
    lightboxTitle.textContent = `${item.projectName} · ${item.kind === "video" ? "Vídeo" : "Imagem"}`;
    lightboxMedia.innerHTML =
      item.kind === "video"
        ? `<video src="${escapeHtml(item.src)}" controls playsinline autoplay></video>`
        : `<img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.filename)}" />`;
    lightboxActions.innerHTML = `
      <a class="button-link outline" href="${escapeHtml(conversationHref(item))}">Abrir conversa</a>
      <a class="button-link outline" href="${escapeHtml(item.src)}" download="${escapeHtml(item.filename)}">Baixar</a>
      <button type="button" class="danger" data-gallery-delete="${escapeHtml(item.id)}">Excluir</button>
    `;
  }

  function findNeighbor(id: string, delta: number): GalleryItem | undefined {
    const list = visibleItems();
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    return list[index + delta];
  }

  async function loadLibrary() {
    setStatus("Carregando…");
    try {
      const [imageRes, videoRes] = await Promise.all([
        canAccessImages()
          ? api("/image-projects/library")
          : Promise.resolve(null),
        canAccessVideos()
          ? api("/video-projects/library")
          : Promise.resolve(null),
      ]);
      const images: ImageLibraryProject[] =
        imageRes && imageRes.ok
          ? ((await imageRes.json()) as ImageLibraryProject[])
          : [];
      const videos: VideoLibraryProject[] =
        videoRes && videoRes.ok
          ? ((await videoRes.json()) as VideoLibraryProject[])
          : [];
      if (imageRes && !imageRes.ok) {
        throw new Error(await readError(imageRes, "Falha ao carregar imagens"));
      }
      if (videoRes && !videoRes.ok) {
        throw new Error(await readError(videoRes, "Falha ao carregar vídeos"));
      }
      items = [...flatten("image", images), ...flatten("video", videos)];
      const count = visibleItems().length;
      setStatus(count ? `${count} ${count === 1 ? "mídia" : "mídias"}` : "");
      renderGrid();
    } catch (error) {
      items = [];
      renderGrid();
      setStatus(errorMessage(error, "Falha ao carregar a galeria"), true);
    }
  }

  async function deleteItem(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (!item || busy) return;
    const label = item.kind === "video" ? "este vídeo" : "esta imagem";
    if (!confirm(`Excluir ${label}?`)) return;
    busy = true;
    try {
      const path =
        item.kind === "image"
          ? `/image-projects/${encodeURIComponent(item.projectId)}/assets/${encodeURIComponent(item.assetId)}`
          : `/video-projects/${encodeURIComponent(item.projectId)}/assets/${encodeURIComponent(item.assetId)}`;
      const res = await api(path, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Falha ao excluir"));
      items = items.filter((entry) => entry.id !== id);
      if (lightboxId === id) closeLightbox();
      const count = visibleItems().length;
      setStatus(count ? `${count} ${count === 1 ? "mídia" : "mídias"}` : "");
      renderGrid();
    } catch (error) {
      setStatus(errorMessage(error, "Falha ao excluir"), true);
    } finally {
      busy = false;
    }
  }

  function syncFilterToPermissions() {
    const imageOk = canAccessImages();
    const videoOk = canAccessVideos();
    if (filter === "image" && !imageOk) filter = videoOk ? "video" : "all";
    if (filter === "video" && !videoOk) filter = imageOk ? "image" : "all";
    if (filter === "all" && !(imageOk && videoOk)) {
      filter = imageOk ? "image" : videoOk ? "video" : "all";
    }
  }

  typeSwitch.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest(
      "[data-gallery-filter]",
    ) as HTMLElement | null;
    const next = btn?.dataset.galleryFilter;
    if (next !== "all" && next !== "image" && next !== "video") return;
    filter = next;
    renderTypeSwitch();
    const count = visibleItems().length;
    setStatus(
      items.length
        ? count
          ? `${count} ${count === 1 ? "mídia" : "mídias"}`
          : ""
        : statusEl.textContent,
    );
    renderGrid();
    if (lightboxId && !visibleItems().some((item) => item.id === lightboxId)) {
      closeLightbox();
    }
  });

  groupSwitch.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest(
      "[data-gallery-group]",
    ) as HTMLElement | null;
    const next = btn?.dataset.galleryGroup;
    if (next !== "recent" && next !== "conversation") return;
    groupMode = next;
    renderGroupSwitch();
    renderGrid();
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    const count = visibleItems().length;
    setStatus(
      items.length
        ? count
          ? `${count} ${count === 1 ? "mídia" : "mídias"}`
          : ""
        : "",
    );
    renderGrid();
  });

  groupsEl.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const open = target?.closest("[data-gallery-open]") as HTMLElement | null;
    if (open?.dataset.galleryOpen) {
      openLightbox(open.dataset.galleryOpen);
      return;
    }
    const remove = target?.closest("[data-gallery-delete]") as HTMLElement | null;
    if (remove?.dataset.galleryDelete) {
      void deleteItem(remove.dataset.galleryDelete);
    }
  });

  lightbox.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-gallery-close]")) {
      closeLightbox();
      return;
    }
    const remove = target?.closest("[data-gallery-delete]") as HTMLElement | null;
    if (remove?.dataset.galleryDelete) {
      void deleteItem(remove.dataset.galleryDelete);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden || currentRoute().name !== "criativo-gallery") return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (!lightboxId) return;
    if (event.key === "ArrowRight") {
      const next = findNeighbor(lightboxId, 1);
      if (next) openLightbox(next.id);
    }
    if (event.key === "ArrowLeft") {
      const prev = findNeighbor(lightboxId, -1);
      if (prev) openLightbox(prev.id);
    }
  });

  function onRoute(route: AppRoute) {
    renderCreativeKinds(kindsEl, creativeKindFromRoute(route) || "gallery");
    if (route.name !== "criativo-gallery") {
      closeLightbox();
      return;
    }
    syncFilterToPermissions();
    renderTypeSwitch();
    renderGroupSwitch();
    void loadLibrary();
  }

  return { onRoute };
}
