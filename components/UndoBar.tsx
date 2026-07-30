"use client";

import { useApp } from "@/lib/store";
import { fmtDateHuman } from "@/lib/time";
import { ReactNode, useEffect } from "react";

const LINGER_MS = 10000;

function Bar({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3
        rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 shadow-xl"
    >
      {children}
    </div>
  );
}

function Undo({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} className="btn" title={title}>
      ↺ Undo <kbd className="kbd ml-0.5">u</kbd>
    </button>
  );
}

function Dismiss({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Dismiss"
      className="text-slate-500 hover:text-slate-300 text-xs leading-none"
    >
      ✕
    </button>
  );
}

/** Transient "that happened — undo?" bar. Deleting without a prompt is the
 *  house style (see 1ceae22); this is the safety net for the actions that take
 *  work off the day on screen: a bulk clear, and a move to another day. */
export default function UndoBar() {
  const cleared = useApp((s) => s.lastCleared);
  const moved = useApp((s) => s.lastMoved);
  const undoClear = useApp((s) => s.undoClear);
  const dismissUndo = useApp((s) => s.dismissUndo);
  const undoMove = useApp((s) => s.undoMove);
  const dismissMove = useApp((s) => s.dismissMove);
  const setDate = useApp((s) => s.setDate);

  // the store keeps at most one offer on the table
  const pending = cleared ?? moved;
  const dismiss = cleared ? dismissUndo : dismissMove;

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(dismiss, LINGER_MS);
    return () => clearTimeout(t);
  }, [pending, dismiss]);

  if (cleared) {
    const n = cleared.tasks.length;
    return (
      <Bar>
        <span className="text-xs text-slate-300">
          Cleared {n} done task{n === 1 ? "" : "s"}
        </span>
        <Undo onClick={undoClear} title="restore them (u)" />
        <Dismiss onClick={dismissUndo} />
      </Bar>
    );
  }

  if (moved) {
    return (
      <Bar>
        <span className="text-xs text-slate-300 truncate max-w-[34ch]">
          Moved{" "}
          {moved.tasks.length === 1
            ? `“${moved.tasks[0].title}”`
            : `${moved.tasks.length} tasks`}{" "}
          to {fmtDateHuman(moved.to)}
        </span>
        <button
          onClick={() => {
            setDate(moved.to);
            dismissMove();
          }}
          className="btn"
          title="open that day"
        >
          go there →
        </button>
        <Undo onClick={undoMove} title="bring it back (u)" />
        <Dismiss onClick={dismissMove} />
      </Bar>
    );
  }

  return null;
}
