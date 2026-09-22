export const THEME_STORAGE_KEY = "namao_studio_theme";

export type StudioTheme = "dark" | "light";

const THEME_COLOR: Record<StudioTheme, string> = {
  dark: "#050505",
  light: "#f4f4f2",
};

export function readStoredTheme(): StudioTheme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    /* private mode / blocked storage */
  }
  return "dark";
}

export function applyStudioTheme(theme: StudioTheme): void {
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

export function toggleStudioTheme(): StudioTheme {
  const next: StudioTheme = readStoredTheme() === "light" ? "dark" : "light";
  applyStudioTheme(next);
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

export function initStudioTheme(button: HTMLElement | null): void {
  const theme = readStoredTheme();
  applyStudioTheme(theme);
  if (!(button instanceof HTMLButtonElement)) return;
  syncThemeButton(button, theme);
  button.addEventListener("click", () => {
    syncThemeButton(button, toggleStudioTheme());
  });
}
