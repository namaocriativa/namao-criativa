import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, apiErrorMessage, studioOrigin } from "./api";
import { initAdminTheme } from "./theme";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  _count?: { users: number; leads: number; customers: number };
};

type TenantStaff = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type TenantActivity = TenantRow & {
  staff: TenantStaff[];
  items: {
    id: string;
    title: string;
    summary: string | null;
    kind: string;
    at: string;
    user?: { id: string; name: string; email: string };
  }[];
};

function statusLabel(status: string): string {
  return status === "disabled" ? "Desativada" : "Ativa";
}

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

export function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [listStatus, setListStatus] = useState("Carregando…");
  const [createStatus, setCreateStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenantActivity | null>(null);
  const [detailStatus, setDetailStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    initAdminTheme(document.getElementById("admin-theme-btn"));
  }, [user]);

  useEffect(() => {
    void (async () => {
      const res = await api("/auth/me");
      if (!res.ok) return;
      const data = (await res.json()) as { user?: AdminUser };
      if (!data.user || data.user.role !== "ROOT") {
        await fetch("/auth/admin/logout", {
          method: "POST",
          credentials: "include",
        });
        window.location.replace("/login");
        return;
      }
      setUser(data.user);
    })();
  }, []);

  async function loadTenants(selectId?: string | null) {
    setListStatus("Carregando…");
    try {
      const res = await api("/studio/tenants");
      const data: unknown = await res.json();
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, "Falha ao carregar contas"));
      }
      const rows = data as TenantRow[];
      setTenants(rows);
      setListStatus(
        rows.length
          ? `${rows.length} conta${rows.length === 1 ? "" : "s"}`
          : "Nenhuma conta ainda.",
      );
      const nextId = selectId ?? selectedId ?? rows[0]?.id ?? null;
      setSelectedId(nextId);
    } catch (error) {
      setListStatus(
        error instanceof Error ? error.message : "Falha ao carregar contas",
      );
    }
  }

  useEffect(() => {
    if (!user) return;
    void loadTenants();
  }, [user]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void (async () => {
      setDetailStatus("Carregando histórico…");
      try {
        const res = await api(
          `/studio/tenants/${encodeURIComponent(selectedId)}/activity`,
        );
        const data: unknown = await res.json();
        if (!res.ok) {
          throw new Error(apiErrorMessage(data, "Falha ao carregar histórico"));
        }
        setDetail(data as TenantActivity);
        setDetailStatus("");
      } catch (error) {
        setDetail(null);
        setDetailStatus(
          error instanceof Error ? error.message : "Falha ao carregar histórico",
        );
      }
    })();
  }, [selectedId]);

  async function createTenant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setCreateStatus("Criando…");
    try {
      const res = await api("/studio/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(fd.get("name") || ""),
          adminEmail: String(fd.get("adminEmail") || ""),
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, "Falha ao criar conta"));
      }
      form.reset();
      setCreateStatus("Conta criada. O admin recebeu o e-mail de acesso.");
      const created = data as TenantRow;
      await loadTenants(created.id);
    } catch (error) {
      setCreateStatus(
        error instanceof Error ? error.message : "Falha ao criar conta",
      );
    }
  }

  async function toggleTenant(id: string, status: string) {
    setBusyId(id);
    try {
      const next = status === "disabled" ? "active" : "disabled";
      const res = await api(`/studio/tenants/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        throw new Error(apiErrorMessage(data, "Falha ao atualizar conta"));
      }
      await loadTenants(id);
    } catch (error) {
      setListStatus(
        error instanceof Error ? error.message : "Falha ao atualizar conta",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function openInStudio(id: string) {
    setBusyId(id);
    try {
      const res = await api(
        `/studio/tenants/${encodeURIComponent(id)}/impersonate`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        throw new Error(apiErrorMessage(data, "Não foi possível abrir no Studio"));
      }
      window.location.assign(`${studioOrigin()}/leads`);
    } catch (error) {
      setListStatus(
        error instanceof Error ? error.message : "Não foi possível abrir no Studio",
      );
      setBusyId(null);
    }
  }

  async function logout() {
    await fetch("/auth/admin/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.replace("/login");
  }

  const selected = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedId) || null,
    [tenants, selectedId],
  );

  if (!user) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <span className="brand">Namão Admin</span>
          </div>
        </header>
        <main>
          <p className="status">Carregando…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a href="/" className="brand-link">
            <img
              className="brand-logo"
              src="/logo-mark.png"
              alt=""
              width={40}
              height={40}
              decoding="async"
            />
            <h1 className="brand">
              <span className="brand-short">Namão</span>
              <span className="brand-full">Namão Admin</span>
            </h1>
          </a>
          <div className="topbar-actions">
            <button
              type="button"
              className="topbar-theme"
              id="admin-theme-btn"
              aria-pressed="false"
              aria-label="Ativar tema claro"
            >
              Claro
            </button>
            <button type="button" className="topbar-logout" onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </div>
      </header>
      <main>
        <h2 className="page-title">Contas</h2>
        <p className="prompt-hint">
          Gestão de todas as contas da plataforma, inclusive Namão. Abrir no
          Studio entra na conta com o cookie do Studio.
        </p>
        <p className="status">{listStatus}</p>

        <form className="users-create app-card" onSubmit={(event) => void createTenant(event)}>
          <h3>Nova conta</h3>
          <label>
            Nome
            <input name="name" type="text" required autoComplete="off" />
          </label>
          <label>
            E-mail do admin
            <input name="adminEmail" type="email" required autoComplete="off" />
          </label>
          <div className="actions">
            <button type="submit">Criar e enviar acesso</button>
          </div>
          <p className="status">{createStatus}</p>
        </form>

        <div className="tenant-layout">
          <section>
            <div className="tenant-grid">
              {tenants.map((tenant) => {
                const counts = tenant._count;
                const meta = [
                  counts ? `${counts.users} pessoas` : null,
                  counts ? `${counts.leads} leads` : null,
                  counts ? `${counts.customers} clientes` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const disabled = tenant.status === "disabled";
                return (
                  <article
                    key={tenant.id}
                    className={`app-card tenant-card${
                      selectedId === tenant.id ? " is-selected" : ""
                    }`}
                  >
                    <div>
                      <h3>{tenant.name}</h3>
                      <p className="tenant-meta">
                        {tenant.slug} · {statusLabel(tenant.status)}
                        {meta ? ` · ${meta}` : ""}
                      </p>
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setSelectedId(tenant.id)}
                      >
                        Detalhe
                      </button>
                      <button
                        type="button"
                        disabled={disabled || busyId === tenant.id}
                        onClick={() => void openInStudio(tenant.id)}
                      >
                        Abrir no Studio
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={busyId === tenant.id}
                        onClick={() => void toggleTenant(tenant.id, tenant.status)}
                      >
                        {disabled ? "Reativar" : "Desativar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="app-card">
            {selected ? (
              <>
                <h3>{detail?.name || selected.name}</h3>
                <p className="tenant-meta">
                  {selected.slug} · {statusLabel(selected.status)}
                </p>
                {detail?._count ? (
                  <p className="tenant-meta">
                    {detail._count.users} pessoas · {detail._count.leads} leads ·{" "}
                    {detail._count.customers} clientes
                  </p>
                ) : null}
                {detail?.staff?.length ? (
                  <ul className="staff-list">
                    {detail.staff.map((person) => (
                      <li key={person.id}>
                        {person.name} · {person.email} · {person.role}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="status">{detailStatus}</p>
                <ul className="activity-list">
                  {(detail?.items || []).map((item) => (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      {item.summary ? <p>{item.summary}</p> : null}
                      <time dateTime={item.at}>{formatWhen(item.at)}</time>
                      {item.user ? (
                        <p>
                          {item.user.name} · {item.user.email}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {detail && detail.items.length === 0 && !detailStatus ? (
                  <p className="status">Nenhum evento ainda.</p>
                ) : null}
              </>
            ) : (
              <p className="status">Selecione uma conta para ver o histórico.</p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
