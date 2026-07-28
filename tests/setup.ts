import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// jsdom ships no matchMedia; the theme boot script asks it for the OS preference.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

// …nor randomUUID on older jsdom builds; the store mints task ids with it.
if (!globalThis.crypto?.randomUUID) {
  let n = 0;
  Object.defineProperty(globalThis, "crypto", {
    value: {
      ...globalThis.crypto,
      randomUUID: () =>
        `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` as const,
    },
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
