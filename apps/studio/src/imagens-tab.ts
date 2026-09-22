import { api } from "./api";
import type { ImageAsset, ImageProject } from "./types";
import { hrefFor, navigate, type AppRoute } from "./router";

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

function assetSrc(asset: ImageAsset | undefined): string {
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

function formatDate(value?: string): string {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function initImagensTab(): {
  onRoute: (route: AppRoute) => void;
} {
  const listEl = requireEl<HTMLElement>("imagens-list");
  const listStatus = requireEl<HTMLElement>("imagens-status");
  const newBtn = requireEl<HTMLButtonElement>("imagens-new-btn");

  let busy = false;

  function setListStatus(message: string, isError = false) {
    listStatus.textContent = message;
    listStatus.classList.toggle("error", isError);
  }

  function renderList(items: ImageProject[]) {
    if (!items.length) {
      listEl.innerHTML = `<li class="empty-filter">Nenhuma conversa ainda. Abra o chat para começar.</li>`;
      return;
    }
    listEl.innerHTML = items
      .map((project) => {
        const id = encodeURIComponent(project.id);
        const name = escapeHtml(project.name || "Projeto");
        const thumb = assetSrc(project.assets?.[0]);
        const thumbHtml = thumb
          ? `<img class="package-thumb" src="${escapeHtml(thumb)}" alt="" />`
          : `<span class="package-thumb package-thumb--empty" aria-hidden="true"></span>`;
        const count = project._count?.messages ?? project.messages?.length ?? 0;
        const updated = formatDate(project.updatedAt);
        return `<li class="package-list-item">
          ${thumbHtml}
          <div class="package-list-body">
            <strong><a href="${hrefFor({ name: "imagens-project", id: project.id })}">${name}</a></strong>
            <span class="meta">${count} mensagem(ns)${updated ? ` · ${escapeHtml(updated)}` : ""}</span>
          </div>
          <div class="actions">
            <a class="button-link outline" href="${hrefFor({ name: "imagens-project", id: project.id })}">Abrir</a>
            <button type="button" class="danger" data-delete-image-project="${id}">Excluir</button>
          </div>
        </li>`;
      })
      .join("");
  }

  async function loadList() {
    setListStatus("Carregando projetos…");
    try {
      const res = await api("/image-projects");
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao listar projetos"));
      }
      const items = (await res.json()) as ImageProject[];
      renderList(items);
      setListStatus(
        items.length ? `${items.length} projeto(s)` : "Nenhum projeto cadastrado",
      );
    } catch (error) {
      renderList([]);
      setListStatus(errorMessage(error, "Falha ao listar projetos"), true);
    }
  }

  async function createProject() {
    if (busy) return;
    busy = true;
    newBtn.disabled = true;
    setListStatus("Criando projeto…");
    try {
      const res = await api("/image-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Novo projeto" }),
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao criar projeto"));
      }
      const project = (await res.json()) as ImageProject;
      navigate({ name: "imagens-project", id: project.id });
    } catch (error) {
      setListStatus(errorMessage(error, "Falha ao criar projeto"), true);
    } finally {
      busy = false;
      newBtn.disabled = false;
    }
  }

  async function deleteProject(id: string) {
    if (busy) return;
    if (!confirm("Excluir este projeto e todas as imagens geradas?")) return;
    busy = true;
    try {
      const res = await api(`/image-projects/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await readError(res, "Falha ao excluir projeto"));
      }
      await loadList();
    } catch (error) {
      setListStatus(errorMessage(error, "Falha ao excluir projeto"), true);
    } finally {
      busy = false;
    }
  }

  newBtn.addEventListener("click", () => void createProject());
  listEl.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement | null)?.closest(
      "[data-delete-image-project]",
    ) as HTMLElement | null;
    if (!target?.dataset.deleteImageProject) return;
    event.preventDefault();
    void deleteProject(decodeURIComponent(target.dataset.deleteImageProject));
  });

  function onRoute(route: AppRoute) {
    if (route.name === "imagens") {
      void loadList();
    }
  }

  return { onRoute };
}
