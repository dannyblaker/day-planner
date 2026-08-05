import { THEME_SCRIPT, currentTheme, setTheme, toggleTheme } from "@/lib/theme";
import { beforeEach, describe, expect, it, vi } from "vitest";

const root = () => document.documentElement;
const prefersLight = (matches: boolean) => {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("light") && matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  );
};

/** the boot script is a string injected into <head>; run it the same way */
const runBootScript = () => new Function(THEME_SCRIPT)();

beforeEach(() => {
  root().removeAttribute("data-theme");
  localStorage.clear();
});

describe("reading the current theme", () => {
  it("reports dark unless the attribute says light", () => {
    expect(currentTheme()).toBe("dark");
    root().dataset.theme = "light";
    expect(currentTheme()).toBe("light");
    root().dataset.theme = "dark";
    expect(currentTheme()).toBe("dark");
  });

  it("treats a nonsense attribute as dark", () => {
    root().dataset.theme = "banana";
    expect(currentTheme()).toBe("dark");
  });
});

describe("setting and toggling", () => {
  it("stamps the attribute and remembers the choice", () => {
    setTheme("light");
    expect(root().dataset.theme).toBe("light");
    expect(localStorage.getItem("crocodiles-theme")).toBe("light");
  });

  it("flips back and forth", () => {
    setTheme("dark");
    toggleTheme();
    expect(currentTheme()).toBe("light");
    toggleTheme();
    expect(currentTheme()).toBe("dark");
  });

  it("still applies the theme when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("private mode");
    });
    expect(() => setTheme("light")).not.toThrow();
    expect(root().dataset.theme).toBe("light");
  });
});

describe("the pre-paint boot script", () => {
  it("applies a saved preference", () => {
    localStorage.setItem("crocodiles-theme", "light");
    runBootScript();
    expect(root().dataset.theme).toBe("light");
  });

  it("falls back to the OS preference when nothing is saved", () => {
    prefersLight(true);
    runBootScript();
    expect(root().dataset.theme).toBe("light");

    root().removeAttribute("data-theme");
    prefersLight(false);
    runBootScript();
    expect(root().dataset.theme).toBe("dark");
  });

  it("prefers the saved choice over the OS setting", () => {
    prefersLight(true);
    localStorage.setItem("crocodiles-theme", "dark");
    runBootScript();
    expect(root().dataset.theme).toBe("dark");
  });

  it("ignores a junk value in storage", () => {
    prefersLight(false);
    localStorage.setItem("crocodiles-theme", "chartreuse");
    runBootScript();
    expect(root().dataset.theme).toBe("dark");
  });

  it("survives storage throwing, rather than leaving the page unstyled", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(runBootScript).not.toThrow();
  });

  it("round-trips with setTheme: what one writes, the other restores", () => {
    setTheme("light");
    root().removeAttribute("data-theme");
    runBootScript();
    expect(currentTheme()).toBe("light");
  });
});
