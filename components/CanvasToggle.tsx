"use client";

import { toggleCanvas } from "@/lib/theme";

/**
 * Water or a plain grid. Both glyphs are rendered and `[data-canvas]` decides
 * which one shows, exactly as ThemeToggle does it: the server and the client emit
 * the same markup, so there is no hydration mismatch and no flash of the wrong
 * one before the preference is read.
 */
export default function CanvasToggle({ hint = true }: { hint?: boolean }) {
  return (
    <button
      onClick={toggleCanvas}
      className="btn"
      aria-label="Toggle the animated water canvas"
      title={`water / plain canvas${hint ? " (w)" : ""}`}
    >
      <span className="canvas-when-water">🌊</span>
      <span className="canvas-when-plain">▦</span>
    </button>
  );
}
