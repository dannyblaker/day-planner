"use client";

import { scheduleDay } from "@/lib/scheduler";
import { fmtDateHuman, fmtDur, nowMinutes, todayISO } from "@/lib/time";
import { Plan } from "@/lib/types";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import Timeline from "./Timeline";

/** Read-only live view of today's plan — poll the server every 5 seconds. */
export default function ShareView({ token }: { token: string }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/plan", { cache: "no-store" });
        const p: Plan | null = await res.json();
        if (stop) return;
        if (!p) return setError("No plan published yet.");
        if (p.shareToken !== token) return setError("Invalid share link.");
        setError(null);
        setPlan(p);
        setUpdatedAt(new Date());
      } catch {
        if (!stop) setError("Could not reach the planner.");
      }
    };
    load();
    const iv = setInterval(load, 5000);
    const tickIv = setInterval(() => setTick((x) => x + 1), 30000);
    return () => {
      stop = true;
      clearInterval(iv);
      clearInterval(tickIv);
    };
  }, [token]);

  if (error && !plan) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500 text-sm">
        {error}
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-600 text-sm">
        Loading…
      </div>
    );
  }

  const date = todayISO();
  const day = plan.days[date];
  const now = nowMinutes();

  if (!day) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500 text-sm">
        No plan for today yet.
      </div>
    );
  }

  const slots = scheduleDay(day, now);
  const total = day.tasks.length;
  const done = day.tasks.filter((t) => t.status === "done").length;
  const active = day.tasks.find((t) => t.status === "active");
  const blocked = day.tasks.filter((t) => t.blocked && t.status !== "done");

  return (
    <div className="min-h-screen bg-background text-slate-300">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 sticky top-0 bg-background/95 backdrop-blur z-20 flex-wrap">
        <h1 className="text-sm font-semibold text-indigo-300">DayFlow</h1>
        <span className="text-xs text-slate-400">{fmtDateHuman(date)}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          live · read-only
        </span>
        <div className="flex-1" />
        <ThemeToggle hint={false} />
        <span className="text-[11px] text-slate-500">
          {done}/{total} done
          {updatedAt &&
            ` · updated ${updatedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}`}
        </span>
      </header>

      <div className="max-w-3xl mx-auto p-5">
        {active && (
          <div className="mb-4 rounded-lg border border-emerald-500/50 bg-emerald-950/30 px-4 py-2.5 text-sm">
            <span className="text-emerald-400">▶ working on now: </span>
            <span className="text-slate-100 font-medium">{active.title}</span>
            <span className="text-slate-500 text-xs">
              {" "}
              · planned {fmtDur(active.duration)}
            </span>
          </div>
        )}
        {blocked.length > 0 && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/20 px-4 py-2.5 text-xs">
            <span className="text-red-400 font-medium">
              ⛔ blocked ({blocked.length}):{" "}
            </span>
            {blocked.map((t) => `${t.title} — ${t.blocked}`).join(" · ")}
          </div>
        )}
        <Timeline
          day={day}
          slots={slots}
          now={now}
          goals={plan.goals}
          isToday
        />
      </div>
    </div>
  );
}
