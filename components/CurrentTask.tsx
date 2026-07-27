"use client";

import { useApp } from "@/lib/store";
import { fmtDur, nowMinutes } from "@/lib/time";
import { Slot } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import { notify } from "@/lib/notify";

export default function CurrentTask({ slots }: { slots: Slot[] }) {
  const day = useApp((s) => s.plan.days[s.date]);
  const { startTask, pauseTask, completeTask } = useApp();
  const [, setTick] = useState(0);
  const overrunNotified = useRef<string | null>(null);

  const active = day?.tasks.find((t) => t.status === "active");

  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(iv);
  }, [active]);

  const elapsed = active
    ? (active.actualMinutes || 0) +
      (active.actualStart != null
        ? Math.max(nowMinutes() - active.actualStart, 0)
        : 0)
    : 0;
  const overrun = active ? elapsed - active.duration : 0;

  useEffect(() => {
    if (active && overrun > 0 && overrunNotified.current !== active.id) {
      overrunNotified.current = active.id;
      notify(`⏰ Time's up: ${active.title}`, `Planned ${fmtDur(active.duration)} — wrap up or keep going.`);
    }
    if (!active) overrunNotified.current = null;
  }, [active, overrun]);

  useEffect(() => {
    document.title = active
      ? `${overrun > 0 ? "⏰" : "▶"} ${fmtDur(Math.abs(active.duration - elapsed))} · ${active.title}`
      : "DayFlow";
  });

  if (!day) return null;

  if (!active) {
    const next = slots.find(
      (s) => s.task.status === "todo" && !s.fixed && s.lane === "focus"
    );
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
          Up next
        </div>
        {next ? (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-slate-200 truncate">
                {next.task.title}
              </div>
              <div className="text-[11px] text-slate-500">
                {fmtDur(next.task.duration)}
              </div>
            </div>
            <button
              onClick={() => startTask(next.task.id)}
              className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              ▶ Start
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-600">All clear. Add a task with n.</p>
        )}
      </div>
    );
  }

  const pct = Math.min((elapsed / active.duration) * 100, 100);
  const mins = Math.floor(Math.abs(overrun));
  const secs = Math.floor((Math.abs(overrun) - mins) * 60);

  return (
    <div
      className={`rounded-lg border p-3 ${
        overrun > 0
          ? "border-red-500/60 bg-red-950/30"
          : "border-emerald-500/50 bg-emerald-950/30"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-400">
          {overrun > 0 ? "Overrunning" : "In progress"}
        </span>
        <span
          className={`font-mono text-lg tabular-nums ${
            overrun > 0 ? "text-red-400" : "text-emerald-300"
          }`}
        >
          {overrun > 0 ? "+" : "−"}
          {mins}:{String(secs).padStart(2, "0")}
        </span>
      </div>
      <div className="text-sm font-medium text-slate-100 truncate mb-2">
        {active.title}
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2">
        <div
          className={`h-full rounded-full ${
            overrun > 0 ? "bg-red-500" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => pauseTask(active.id)}
          className="flex-1 text-xs px-2 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200"
        >
          ⏸ Pause
        </button>
        <button
          onClick={() => completeTask(active.id)}
          className="flex-1 text-xs px-2 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          ✓ Done
        </button>
      </div>
    </div>
  );
}
