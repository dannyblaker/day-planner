export type Theme = "light" | "dark";
/** What the flowchart floats on: animated water, or a quiet grid. */
export type CanvasStyle = "water" | "plain";

const KEY = "crocodiles-theme";
const CANVAS_KEY = "crocodiles-canvas";

/**
 * Runs synchronously in <head>, before first paint: picks the saved theme and
 * canvas (or the OS preference, for the theme) and stamps both on <html>, so the
 * server-rendered defaults never flash. See
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 *
 * Two try blocks rather than one: a storage read that throws should cost the
 * preference it was reading and nothing else. Whatever it can't set keeps the
 * value the server rendered.
 */
export const THEME_SCRIPT = `(function(){var r=document.documentElement;try{var t=localStorage.getItem(${JSON.stringify(
  KEY
)});if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";r.dataset.theme=t}catch(e){}try{r.dataset.canvas=localStorage.getItem(${JSON.stringify(
  CANVAS_KEY
)})==="plain"?"plain":"water"}catch(e){}})()`;

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

/** Water unless the attribute says otherwise — the swamp is the default. */
export function currentCanvas(): CanvasStyle {
  return document.documentElement.dataset.canvas === "plain" ? "plain" : "water";
}

export function setCanvas(style: CanvasStyle) {
  document.documentElement.dataset.canvas = style;
  try {
    localStorage.setItem(CANVAS_KEY, style);
  } catch {
    // as above: the canvas still changes, it just won't be remembered
  }
}

/** Flip water ⇄ plain, by exactly the same means as the theme. */
export function toggleCanvas() {
  setCanvas(currentCanvas() === "water" ? "plain" : "water");
}
