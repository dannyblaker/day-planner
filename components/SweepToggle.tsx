"use client";

import { useApp } from "@/lib/store";
import { currentSweep, setSweep as rememberSweep } from "@/lib/theme";

/**
 * Whether finished work takes itself off the board.
 *
 * Both glyphs are rendered and `[data-sweep]` decides which shows, as the theme
 * and canvas toggles do it: the server and the client emit the same markup, so
 * there is no flash of the wrong one before the preference is read. The store
 * gets told too, because unlike those two this preference is behaviour rather
 * than paint, and something has to start and stop the clock.
 */
export default function SweepToggle() {
  return (
    <button
      onClick={() => {
        const next = !currentSweep();
        rememberSweep(next);
        useApp.getState().setSweep(next);
      }}
      className="btn"
      aria-label="Toggle sweeping finished work off the board"
      title="finished work deletes itself once the whole chain is done"
    >
      <span className="sweep-when-on">🧹</span>
      <span className="sweep-when-off">🗄️</span>
    </button>
  );
}
