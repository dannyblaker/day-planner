export type Theme = "light" | "dark";

const KEY = "crocodiles-theme";

/**
 * Runs synchronously in <head>, before first paint: picks the saved theme (or
 * the OS preference) and stamps it on <html>, so the server-rendered default
 * never flashes. See node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  KEY
)});if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){}})()`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // private mode / storage disabled — the choice just won't survive a reload
  }
}

/** Flip light ⇄ dark. State lives in the DOM + localStorage, not in React:
 *  the UI that depends on it is styled by `[data-theme]` in globals.css. */
export function toggleTheme() {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
}
