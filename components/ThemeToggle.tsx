"use client";

import { toggleTheme } from "@/lib/theme";

/** Both glyphs are rendered; `[data-theme]` decides which one shows. */
export default function ThemeToggle({ hint = true }: { hint?: boolean }) {
  return (
    <button
      onClick={toggleTheme}
      className="btn"
      aria-label="Toggle light or dark theme"
      title={`light / dark theme${hint ? " (m)" : ""}`}
    >
      <span className="theme-when-dark">☀️</span>
      <span className="theme-when-light">🌙</span>
    </button>
  );
}
