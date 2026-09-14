import { api } from "./api";
import { getStudioUser } from "./session";

type StudioUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
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

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento #${id} não encontrado`);
  return node as T;
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
  };
  const raw = data.message;
  return Array.isArray(raw) ? raw[0] : raw || `Erro ${res.status}`;
}

export function initUsersTab() {
  const listEl = el<HTMLElement>("users-list");
  const statusEl = el<HTMLElement>("users-status");
  const form = el<HTMLFormElement>("users-create-form");
  const createStatus = el<HTMLElement>("users-create-status");

  async function reload() {
    statusEl.textContent = "Carregando…";
    statusEl.classList.remove("error");
    try {
      const res = await api("/studio/users");
      if (!res.ok) throw new Error(await readError(res));
      const rows = (await res.json()) as StudioUserRow[];
      const me = getStudioUser();
      if (!rows.length) {
        listEl.innerHTML = `<p class="empty-detail">Nenhum usuário do studio.</p>`;
      } else {
        listEl.innerHTML = `<ul class="users-grid">${rows
          .map((user) => {
            const self = user.id === me?.id;
            return `<li class="app-card users-card" data-id="${escapeHtml(user.id)}">
              <div class="users-card-head">
                <strong>${escapeHtml(user.name)}</strong>
                <span class="users-role">${escapeHtml(roleLabel(user.role))}</span>
              </div>
              <p class="users-email">${escapeHtml(user.email)}</p>
              <div class="users-card-actions">
                <label>
                  Papel
                  <select data-role-select ${self ? "disabled" : ""}>
                    <option value="OPERATOR" ${user.role === "OPERATOR" ? "selected" : ""}>Operador</option>
                    <option value="ADMIN" ${user.role === "ADMIN" ? "selected" : ""}>Admin</option>
                  </select>
                </label>
                <button type="button" class="secondary" data-reset>Resetar senha</button>
                <button type="button" class="danger" data-remove ${self ? "disabled" : ""}>Remover</button>
              </div>
            </li>`;
          })
          .join("")}</ul>`;
      }
      statusEl.textContent = `${rows.length} usuário(s)`;
    } catch (error) {
      statusEl.textContent = errorMessage(error, "Falha ao listar usuários");
      statusEl.classList.add("error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    createStatus.textContent = "Criando…";
    createStatus.classList.remove("error");
    try {
      const res = await api("/studio/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(fd.get("name") || "").trim(),
          email: String(fd.get("email") || "").trim(),
          password: String(fd.get("password") || ""),
          role: String(fd.get("role") || "OPERATOR"),
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      form.reset();
      createStatus.textContent = "Usuário criado.";
      await reload();
    } catch (error) {
      createStatus.textContent = errorMessage(error, "Falha ao criar");
      createStatus.classList.add("error");
    }
  });

  listEl.addEventListener("change", async (event) => {
    const select = (event.target as HTMLElement | null)?.closest(
      "select[data-role-select]",
    ) as HTMLSelectElement | null;
    if (!select) return;
    const card = select.closest<HTMLElement>("[data-id]");
    const id = card?.dataset.id;
    if (!id) return;
    statusEl.textContent = "Atualizando papel…";
    try {
      const res = await api(`/studio/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: select.value }),
      });
      if (!res.ok) throw new Error(await readError(res));
      await reload();
    } catch (error) {
      statusEl.textContent = errorMessage(error, "Falha ao atualizar");
      statusEl.classList.add("error");
      await reload();
    }
  });

  listEl.addEventListener("click", async (event) => {
    const target = (event.target as HTMLElement | null)?.closest("button");
    if (!target) return;
    const card = target.closest<HTMLElement>("[data-id]");
    const id = card?.dataset.id;
    if (!id) return;
    if (target.matches("[data-reset]")) {
      statusEl.textContent = "Resetando senha…";
      try {
        const res = await api(
          `/studio/users/${encodeURIComponent(id)}/reset-password`,
          { method: "POST" },
        );
        if (!res.ok) throw new Error(await readError(res));
        await res.json().catch(() => ({}));
        statusEl.textContent = "Nova senha enviada por e-mail.";
        statusEl.classList.remove("error");
      } catch (error) {
        statusEl.textContent = errorMessage(error, "Falha ao resetar senha");
        statusEl.classList.add("error");
      }
      return;
    }
    if (target.matches("[data-remove]")) {
      if (!confirm("Remover este usuário do studio?")) return;
      statusEl.textContent = "Removendo…";
      try {
        const res = await api(`/studio/users/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(await readError(res));
        await reload();
      } catch (error) {
        statusEl.textContent = errorMessage(error, "Falha ao remover");
        statusEl.classList.add("error");
      }
    }
  });

  return { reload };
}
