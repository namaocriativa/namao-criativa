import "./style.css";
import { useState, type FormEvent } from "react";
import { apiErrorMessage } from "./api";

const REMEMBER_KEY = "namao_admin_remember";

export function LoginPage() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem(REMEMBER_KEY) !== "0";
    } catch {
      return true;
    }
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    try {
      localStorage.setItem(REMEMBER_KEY, rememberMe ? "1" : "0");
    } catch {
      /* ignore */
    }
    setStatus("Entrando…");
    setError(false);
    try {
      const res = await fetch("/auth/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") || ""),
          password: String(fd.get("password") || ""),
          rememberMe,
        }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, `Erro ${res.status}`));
      }
      const next = new URLSearchParams(location.search).get("next");
      const fallback = "/";
      const dest =
        next && next.startsWith("/") && !next.startsWith("//") && !next.includes("://")
          ? next
          : fallback;
      location.replace(dest);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Falha no login");
      setError(true);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href="/login" className="brand-link">
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
          <button
            type="button"
            className="topbar-theme"
            id="admin-theme-btn"
            aria-pressed="false"
            aria-label="Ativar tema claro"
          >
            Claro
          </button>
        </div>
      </header>
      <main className="auth-card">
        <p className="auth-kicker">Acesso interno</p>
        <h1>Entrar</h1>
        <p className="auth-hint">Só para o root da plataforma.</p>
        <form onSubmit={onSubmit}>
          <label>
            E-mail
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
            />
          </label>
          <label className="auth-remember">
            <input
              type="checkbox"
              name="rememberMe"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            Manter-me conectado
          </label>
          <button type="submit">Entrar</button>
        </form>
        <p className={`status${error ? " error" : ""}`}>{status}</p>
      </main>
    </>
  );
}
