"use client";

import { statuses } from "@/lib/graph";
import { Plan, STATUS_COLOR } from "@/lib/types";
import { useEffect, useState } from "react";
import CanvasToggle from "./CanvasToggle";
import FlowCanvas from "./FlowCanvas";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

/** Read-only live view of the plan — poll the server every 5 seconds. */
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
        if (!stop) setError("Could not reach the swamp.");
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
      <div className="h-screen flex items-center justify-center text-slate-500 text-title">
        {error}
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-600 text-title">
        Loading…
      </div>
    );
  }

  const total = plan.tasks.length;
  const done = plan.tasks.filter((t) => t.done).length;
  const statusOfId = statuses(plan.tasks);
  const inProgress = plan.tasks.filter((t) => statusOfId.get(t.id) === "in-progress");
  const blocked = plan.tasks.filter((t) => t.blocked && !t.done);

  return (
    <div className="min-h-screen bg-background text-slate-300">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-slate-800 sticky top-0 bg-background/95 backdrop-blur z-20 flex-wrap">
        <h1 className="flex items-center gap-2 text-title font-semibold text-slate-100">
          <Logo className="w-9 h-6 shrink-0" />
          Concurrent Crocodiles
        </h1>
        <span className="flex items-center gap-1.5 text-label text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          live · read-only
        </span>
        <div className="flex-1" />
        <CanvasToggle hint={false} />
        <ThemeToggle hint={false} />
        <span className="text-label text-slate-500">
          {done}/{total} done
          {updatedAt &&
            ` · updated ${updatedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}`}
        </span>
      </header>

      <div className="h-[calc(100vh-53px)] flex flex-col p-5 gap-4">
        {inProgress.length > 0 && (
          <div className="rounded-lg border px-4 py-2.5 text-title card-skin status-in-progress">
            <span style={{ color: STATUS_COLOR["in-progress"] }}>
              🐊 in progress ({inProgress.length}):{" "}
            </span>
            {inProgress.map((t, i) => (
              <span key={t.id}>
                {i > 0 && <span className="text-slate-500"> · </span>}
                <span className="text-slate-100 font-medium">{t.title}</span>
              </span>
            ))}
          </div>
        )}
        {blocked.length > 0 && (
          <div className="rounded-lg border border-red-900 bg-red-950/20 px-4 py-2.5 text-label">
            <span className="text-red-400 font-medium">
              ⛔ blocked ({blocked.length}):{" "}
            </span>
            {blocked.map((t) => `${t.title} — ${t.blocked}`).join(" · ")}
          </div>
        )}
        {/* no editing callbacks: the canvas renders itself read-only */}
        <FlowCanvas tasks={plan.tasks} goals={plan.goals} />
      </div>
    </div>
  );
}
