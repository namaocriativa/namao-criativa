import { api } from "./api";
import { canAccessImages, canAccessVideos, getStudioUser } from "./session";
import { hrefFor, navigate, titleForRoute, type AppRoute } from "./router";

type StudioUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  canAccessImages?: boolean;
  canAccessVideos?: boolean;
  createdAt: string;
};

type ActivityItem = {
  id: string;
  title: string;
  summary: string | null;
  kind: string;
  at: string;
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

function roleLabel(role: string): string {
  return role === "ADMIN" ? "Admin" : "Operador";
}

function permissionChipsHtml(user: StudioUserRow): string {
  const chips: string[] = [];
  if (canAccessImages(user)) chips.push("Imagens");
  if (canAccessVideos(user)) chips.push("Vídeos");
  if (!chips.length) return "";
  return `<div class="users-card-perms">${chips
    .map((label) => `<span class="users-perm">${escapeHtml(label)}</span>`)
    .join("")}</div>`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return String(value);
  }
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { message?: string | string[] };
    const raw = data.message;
    return Array.isArray(raw) ? raw[0] : raw || `Erro ${res.status}`;
  } catch {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return 'A API não respondeu. Atualize a página e tente de novo.';
    }
    return `Erro ${res.status}`;
  }
}

export function initUsersTab() {
  const listEl = el<HTMLElement>("users-list");
  const statusEl = el<HTMLElement>("users-status");
  const form = el<HTMLFormElement>("users-create-form");
  const createStatus = el<HTMLElement>("users-create-status");
  const heading = el<HTMLElement>("user-detail-heading");
  const meta = el<HTMLElement>("user-detail-meta");
  const detailStatus = el<HTMLElement>("user-detail-status");
  const roleSelect = el<HTMLSelectElement>("user-role-select");
  const imagesPermission = el<HTMLInputElement>("user-permission-images");
  const videosPermission = el<HTMLInputElement>("user-permission-videos");
  const permissionsHint = el<HTMLElement>("user-permissions-hint");
  const resetBtn = el<HTMLButtonElement>("user-reset-btn");
  const deleteBtn = el<HTMLButtonElement>("user-delete-btn");
  const activityList = el<HTMLElement>("user-activity-list");
  const activityHint = el<HTMLElement>("user-activity-hint");

  let current: StudioUserRow | null = null;
  let loadSeq = 0;

  function setListStatus(message: string, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  }

  function setCreateStatus(message: string, isError = false) {
    createStatus.textContent = message;
    createStatus.classList.toggle("error", isError);
  }

  function setDetailStatus(message: string, isError = false) {
    detailStatus.textContent = message;
    detailStatus.classList.toggle("error", isError);
  }

  function renderList(rows: StudioUserRow[]) {
    if (!rows.length) {
      listEl.innerHTML = `<p class="empty-detail">Nenhum usuário do studio.</p>`;
      return;
    }
    listEl.innerHTML = `<ul class="users-grid">${rows
      .map((user) => {
        const href = hrefFor({ name: "user", id: user.id });
        return `<li>
          <a class="app-card users-card" href="${escapeHtml(href)}">
            <div class="users-card-head">
              <strong>${escapeHtml(user.name)}</strong>
              <span class="users-role">${escapeHtml(roleLabel(user.role))}</span>
            </div>
            <p class="users-email">${escapeHtml(user.email)}</p>
            ${permissionChipsHtml(user)}
          </a>
        </li>`;
      })
      .join("")}</ul>`;
  }

  function renderActivity(items: ActivityItem[]) {
    const recorded = items.filter((item) => item.kind !== "account.created");
    activityHint.hidden = recorded.length > 0;
    activityList.innerHTML = items.length
      ? items
          .map(
            (item) =>
              `<li><strong>${escapeHtml(item.title)}</strong>${
                item.summary
                  ? `<p class="meta">${escapeHtml(item.summary)}</p>`
                  : ""
              }${
                item.at
                  ? `<p class="meta">${escapeHtml(formatDate(item.at))}</p>`
                  : ""
              }</li>`,
          )
          .join("")
      : `<li><strong>Sem histórico</strong></li>`;
  }

  function fillDetail(user: StudioUserRow) {
    current = user;
    const me = getStudioUser();
    const self = user.id === me?.id;
    heading.textContent = user.name || user.email;
    meta.textContent = `${user.email} · ${roleLabel(user.role)} · desde ${formatDate(user.createdAt)}`;
    roleSelect.value = user.role === "ADMIN" ? "ADMIN" : "OPERATOR";
    roleSelect.disabled = self;
    const adminUser = user.role === "ADMIN";
    imagesPermission.checked = canAccessImages(user);
    videosPermission.checked = canAccessVideos(user);
    imagesPermission.disabled = adminUser;
    videosPermission.disabled = adminUser;
    permissionsHint.textContent = adminUser
      ? "Admin já tem acesso às abas Imagens e Vídeos."
      : "Libere as abas que esta pessoa pode usar.";
    deleteBtn.disabled = self;
    document.title = titleForRoute({ name: "user", id: user.id }, user.name);
  }

  async function reloadList() {
    setListStatus("Carregando…");
    try {
      const res = await api("/studio/users");
      if (!res.ok) throw new Error(await readError(res));
      const rows = (await res.json()) as StudioUserRow[];
      renderList(rows);
      setListStatus(`${rows.length} usuário(s)`);
    } catch (error) {
      setListStatus(errorMessage(error, "Falha ao listar usuários"), true);
    }
  }

  async function loadDetail(id: string) {
    const seq = ++loadSeq;
    current = null;
    heading.textContent = "Usuário";
    meta.textContent = "";
    setDetailStatus("Carregando…");
    activityList.innerHTML = `<li><strong>Carregando histórico…</strong></li>`;
    activityHint.hidden = true;
    try {
      const [userRes, activityRes] = await Promise.all([
        api(`/studio/users/${encodeURIComponent(id)}`),
        api(`/studio/users/${encodeURIComponent(id)}/activity`),
      ]);
      if (seq !== loadSeq) return;
      if (!userRes.ok) throw new Error(await readError(userRes));
      const user = (await userRes.json()) as StudioUserRow;
      if (seq !== loadSeq) return;
      fillDetail(user);
      setDetailStatus("");
      if (!activityRes.ok) {
        renderActivity([]);
        setDetailStatus(await readError(activityRes), true);
        return;
      }
      const data = (await activityRes.json()) as { items?: ActivityItem[] };
      if (seq !== loadSeq) return;
      renderActivity(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      if (seq !== loadSeq) return;
      setDetailStatus(errorMessage(error, "Falha ao abrir usuário"), true);
      activityList.innerHTML = `<li><strong>Sem histórico</strong></li>`;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    setCreateStatus("Enviando convite…");
    try {
      const res = await api("/studio/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") || "").trim(),
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      form.reset();
      setCreateStatus("Convite enviado por e-mail.");
      await reloadList();
    } catch (error) {
      setCreateStatus(errorMessage(error, "Falha ao enviar convite"), true);
    }
  });

  roleSelect.addEventListener("change", async () => {
    if (!current) return;
    setDetailStatus("Atualizando papel…");
    try {
      const res = await api(`/studio/users/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleSelect.value }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const user = (await res.json()) as StudioUserRow;
      fillDetail(user);
      setDetailStatus("Papel atualizado.");
      await loadDetail(user.id);
    } catch (error) {
      setDetailStatus(errorMessage(error, "Falha ao atualizar"), true);
      if (current) roleSelect.value = current.role === "ADMIN" ? "ADMIN" : "OPERATOR";
    }
  });

  async function patchPermission(
    field: "canAccessImages" | "canAccessVideos",
    checkbox: HTMLInputElement,
    okMessage: string,
  ) {
    if (!current || current.role === "ADMIN") return;
    const next = checkbox.checked;
    setDetailStatus("Atualizando acesso…");
    try {
      const res = await api(`/studio/users/${encodeURIComponent(current.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const user = (await res.json()) as StudioUserRow;
      fillDetail(user);
      setDetailStatus(okMessage);
    } catch (error) {
      checkbox.checked = !next;
      setDetailStatus(errorMessage(error, "Falha ao atualizar acesso"), true);
    }
  }

  imagesPermission.addEventListener("change", () => {
    void patchPermission(
      "canAccessImages",
      imagesPermission,
      "Acesso a Imagens atualizado.",
    );
  });

  videosPermission.addEventListener("change", () => {
    void patchPermission(
      "canAccessVideos",
      videosPermission,
      "Acesso a Vídeos atualizado.",
    );
  });

  resetBtn.addEventListener("click", async () => {
    if (!current) return;
    setDetailStatus("Resetando senha…");
    try {
      const res = await api(
        `/studio/users/${encodeURIComponent(current.id)}/reset-password`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await readError(res));
      setDetailStatus("Nova senha enviada por e-mail.");
      await loadDetail(current.id);
    } catch (error) {
      setDetailStatus(errorMessage(error, "Falha ao resetar senha"), true);
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!current) return;
    if (!confirm("Remover este usuário do studio?")) return;
    setDetailStatus("Removendo…");
    try {
      const res = await api(`/studio/users/${encodeURIComponent(current.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await readError(res));
      current = null;
      navigate({ name: "users" });
    } catch (error) {
      setDetailStatus(errorMessage(error, "Falha ao remover"), true);
    }
  });

  return {
    reload: reloadList,
    onRoute(route: AppRoute) {
      if (route.name === "users") void reloadList();
      if (route.name === "user") void loadDetail(route.id);
    },
  };
}
