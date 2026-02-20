export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "theme";

export function getStoredTheme(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return null;
}

export function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getEffectiveTheme(): ThemeMode {
  return getStoredTheme() ?? getSystemTheme();
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.classList.remove("v-theme--scannerLight", "v-theme--scannerDark");
  root.classList.add(mode === "dark" ? "v-theme--scannerDark" : "v-theme--scannerLight");
  localStorage.setItem(STORAGE_KEY, mode);
  document.dispatchEvent(new CustomEvent("theme-changed", { detail: mode }));
}
