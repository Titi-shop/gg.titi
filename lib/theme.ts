const MODE_KEY = "theme-mode";

export type ThemeMode = "light" | "dark";
export type ThemeRole = "customer" | "seller";

export function getSavedMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem(MODE_KEY) as ThemeMode) || "light";
}

export function setMode(mode: ThemeMode) {
  localStorage.setItem(MODE_KEY, mode);
}

export function applyTheme(role: ThemeRole, mode: ThemeMode) {
  const root = document.documentElement;

  root.classList.remove(
    "theme-light",
    "theme-dark",
    "theme-customer",
    "theme-seller"
  );

  root.classList.add(
    mode === "dark" ? "theme-dark" : "theme-light",
    role === "seller" ? "theme-seller" : "theme-customer"
  );

  window.dispatchEvent(new Event("theme-change"));
}

export function toggleDarkMode(role: ThemeRole) {
  const current = getSavedMode();
  const next = current === "dark" ? "light" : "dark";

  setMode(next);
  applyTheme(role, next);
}
