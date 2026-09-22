const LOGIN_PATH = "/login";

function onLoginPage(): boolean {
  const path = window.location.pathname;
  return path.endsWith("/login.html") || path === "/login";
}

export function apiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const raw = (data as { message?: unknown }).message;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  if (typeof raw === "string" && raw.trim()) return raw;
  return fallback;
}

export async function api(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: "include" });
  if (res.status === 401 && !onLoginPage()) {
    window.location.replace(LOGIN_PATH);
  }
  return res;
}

export function studioOrigin(): string {
  const fromEnv = import.meta.env.VITE_NAMAO_STUDIO_URL?.trim();
  return (fromEnv || "http://localhost:5173").replace(/\/$/, "");
}
