"use client";

import { useApp } from "@/lib/store";
import { fmtDur } from "@/lib/format";
import { useState } from "react";

export default function GoalsPanel() {
  const goals = useApp((s) => s.plan.goals);
  const tasks = useApp((s) => s.plan.tasks);
  const { addGoal, deleteGoal } = useApp();
  const [name, setName] = useState("");

  const stats = goals.map((g) => {
    const mine = tasks.filter((t) => t.goalId === g.id);
    const planned = mine.reduce((sum, t) => sum + t.duration, 0);
    const done = mine.filter((t) => t.done).reduce((sum, t) => sum + t.duration, 0);
    return { goal: g, planned, done, count: mine.length };
  });
  const unmapped = tasks.filter((t) => !t.goalId && !t.done).length;
  const max = Math.max(...stats.map((s) => s.planned), 1);

  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider text-slate-500 px-2 mb-1.5">
        Goals — work mapped, done vs. planned
      </h3>
      <div className="space-y-1.5 px-2">
        {stats.map(({ goal, planned, done, count }) => (
          <div key={goal.id} className="group">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: goal.color }}
              />
              <span className="text-slate-300 truncate flex-1">{goal.name}</span>
              <span className="text-slate-500 tabular-nums">
                {count > 0 ? `${fmtDur(done)} / ${fmtDur(planned)}` : "—"}
              </span>
              <button
                onClick={() => deleteGoal(goal.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-[10px]"
                title="delete goal"
              >
                ✕
              </button>
            </div>
            <div className="h-1 rounded-full bg-slate-800 mt-0.5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(planned / max) * 100}%`,
                  backgroundColor: goal.color,
                  opacity: 0.7,
                }}
              />
            </div>
          </div>
        ))}
        {unmapped > 0 && (
          <p className="text-[10px] text-slate-600">
            {unmapped} task{unmapped > 1 ? "s" : ""} not mapped to a goal
          </p>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              addGoal(name);
              setName("");
            }
            e.stopPropagation();
          }}
          placeholder="+ new goal"
          className="w-full bg-transparent border-b border-slate-800 focus:border-indigo-500 outline-none px-0.5 py-1 text-[11px] text-slate-300 placeholder:text-slate-600"
        />
      </div>
    </div>
  );
}
