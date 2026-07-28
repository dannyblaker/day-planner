"use client";

import { useApp } from "@/lib/store";
import { useEffect } from "react";

const LINGER_MS = 10000;

/** Transient "cleared N tasks — undo" bar. Deleting without a prompt is the
 *  house style (see 1ceae22); this is the safety net for the bulk version. */
export default function UndoBar() {
  const cleared = useApp((s) => s.lastCleared);
  const undoClear = useApp((s) => s.undoClear);
  const dismissUndo = useApp((s) => s.dismissUndo);

  useEffect(() => {
    if (!cleared) return;
    const t = setTimeout(dismissUndo, LINGER_MS);
    return () => clearTimeout(t);
  }, [cleared, dismissUndo]);

  if (!cleared) return null;
  const n = cleared.tasks.length;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3
        rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 shadow-xl"
    >
      <span className="text-xs text-slate-300">
        Cleared {n} done task{n === 1 ? "" : "s"}
      </span>
      <button onClick={undoClear} className="btn" title="restore them (u)">
        ↺ Undo <kbd className="kbd ml-0.5">u</kbd>
      </button>
      <button
        onClick={dismissUndo}
        aria-label="Dismiss"
        className="text-slate-500 hover:text-slate-300 text-xs leading-none"
      >
        ✕
      </button>
    </div>
  );
}
