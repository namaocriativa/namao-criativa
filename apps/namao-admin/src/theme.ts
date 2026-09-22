export const THEME_STORAGE_KEY = "namao_admin_theme";

export type AdminTheme = "dark" | "light";

const THEME_COLOR: Record<AdminTheme, string> = {
  dark: "#050505",
  light: "#f4f4f2",
};

export function readStoredTheme(): AdminTheme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* private mode / blocked storage */
  }
  return "dark";
}

export function applyAdminTheme(theme: AdminTheme): void {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLOR[theme]);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function toggleAdminTheme(): AdminTheme {
  const next: AdminTheme = readStoredTheme() === "light" ? "dark" : "light";
  applyAdminTheme(next);
  return next;
}

export function syncThemeButton(
  button: HTMLButtonElement,
  theme = readStoredTheme(),
): void {
  const light = theme === "light";
  button.textContent = light ? "Escuro" : "Claro";
  button.setAttribute(
    "aria-label",
    light ? "Ativar tema escuro" : "Ativar tema claro",
  );
  button.setAttribute("aria-pressed", light ? "true" : "false");
}

export function initAdminTheme(button: HTMLElement | null): void {
  const theme = readStoredTheme();
  applyAdminTheme(theme);
  if (!(button instanceof HTMLButtonElement)) return;
  syncThemeButton(button, theme);
  if (button.dataset.themeReady === "1") return;
  button.dataset.themeReady = "1";
  button.addEventListener("click", () => {
    syncThemeButton(button, toggleAdminTheme());
  });
}
