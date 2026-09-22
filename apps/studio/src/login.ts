import "./style.css";
import { safeNextPath } from "./safe-next-path";
import { initStudioTheme } from "./theme";

initStudioTheme(document.getElementById("studio-theme-btn"));

const REMEMBER_KEY = "namao_studio_remember";

const form = document.getElementById("login-form") as HTMLFormElement;
const statusEl = document.getElementById("login-status") as HTMLElement;
const rememberEl = document.getElementById(
  "login-remember",
) as HTMLInputElement | null;

if (rememberEl) {
  rememberEl.checked = localStorage.getItem(REMEMBER_KEY) !== "0";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fd = new FormData(form);
  const rememberMe = rememberEl?.checked ?? true;
  localStorage.setItem(REMEMBER_KEY, rememberMe ? "1" : "0");
  statusEl.textContent = "Entrando…";
  statusEl.classList.remove("error");
  try {
    const res = await fetch("/auth/studio/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(fd.get("email") || ""),
        password: String(fd.get("password") || ""),
        rememberMe,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    if (!res.ok) {
      const raw = data.message;
      throw new Error(Array.isArray(raw) ? raw[0] : raw || `Erro ${res.status}`);
    }
    const next = new URLSearchParams(location.search).get("next");
    location.replace(safeNextPath(next, "/leads"));
  } catch (error) {
    statusEl.textContent =
      error instanceof Error ? error.message : "Falha no login";
    statusEl.classList.add("error");
  }
});
