"use client";

import { useApp } from "@/lib/store";

const SHORTCUTS: [string, string][] = [
  ["n / c / ⌘K", "add task (quick-add)"],
  ["j / k or ↓ / ↑", "select next / previous task"],
  ["Shift+J / Shift+K", "move task down / up the queue"],
  ["Enter / e", "edit selected task"],
  ["Space", "start / pause timer on selected task"],
  ["d", "toggle done"],
  ["b", "toggle blocked"],
  ["1 – 4", "set priority P1–P4"],
  ["p", "toggle parallel (background lane)"],
  ["+ / -", "duration +15m / −15m"],
  ["s", "auto-sort queue by priority"],
  ["o", "defer selected task to tomorrow"],
  ["x / Del", "delete selected task"],
  ["[ / ]", "previous / next day"],
  ["t", "jump to today"],
  ["?", "this help"],
  ["Esc", "close panels / deselect"],
];

const SYNTAX: [string, string][] = [
  ["45m · 1h · 1h30", "duration"],
  ["!1 … !4", "priority (P1 = do or die)"],
  ["#deep-work", "goal — created if new"],
  ["@2pm · @14:30", "fixed start time (meeting)"],
  [">design", "depends on task whose title starts with “design”"],
  ["~", "parallel / background task"],
  ["*waiting-on-bob", "blocked, with reason"],
  ["^", "spontaneous: do next — everything else shifts"],
];

export default function HelpOverlay() {
  const open = useApp((s) => s.helpOpen);
  const setHelpOpen = useApp((s) => s.setHelpOpen);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={() => setHelpOpen(false)}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Keyboard shortcuts
          </h2>
          <button
            onClick={() => setHelpOpen(false)}
            className="text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 mb-5">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <kbd className="kbd">{key}</kbd>
              <span className="text-slate-400">{desc}</span>
            </div>
          ))}
        </div>
        <h2 className="text-sm font-semibold text-slate-200 mb-2">
          Quick-add syntax
        </h2>
        <p className="text-[11px] text-slate-500 mb-2">
          Type a title plus any tokens, e.g.{" "}
          <code className="text-indigo-300">
            Fix login bug 1h !1 #deep-work &gt;deploy ^
          </code>
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
          {SYNTAX.map(([key, desc]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <code className="kbd">{key}</code>
              <span className="text-slate-400">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
