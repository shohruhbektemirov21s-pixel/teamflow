import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const KEY = "theme";
const listeners = new Set<() => void>();

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* brauzer xotirasi yopiq bo'lishi mumkin */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

let current: Theme = initial();

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}
apply(current);

/** Tanlangan rejim butun ilovada bitta: Sozlamalar, yuqori panel va kirish sahifasi bir xil holatni ko'radi.
 * Brauzerda saqlanadi (`localStorage`), shuning uchun barcha sahifalarda va qayta ochilganda ham o'sha rejim. */
export function setTheme(theme: Theme) {
  if (theme === current) return;
  current = theme;
  apply(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* e'tiborsiz */
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => current);
  return [theme, () => setTheme(theme === "dark" ? "light" : "dark")] as const;
}
