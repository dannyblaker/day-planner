"use client";

import { useApp } from "@/lib/store";
import { useState } from "react";

export default function GoalsPanel() {
  const goals = useApp((s) => s.plan.goals);
  const tasks = useApp((s) => s.plan.tasks);
  const { addGoal, deleteGoal } = useApp();
  const [name, setName] = useState("");

  // Counted in tasks, because nothing in the plan claims to know how long a
  // task takes — there is no duration on a task to add up.
  const stats = goals.map((g) => {
    const mine = tasks.filter((t) => t.goalId === g.id);
    return {
      goal: g,
      count: mine.length,
      done: mine.filter((t) => t.done).length,
    };
  });
  const unmapped = tasks.filter((t) => !t.goalId && !t.done).length;
  const max = Math.max(...stats.map((s) => s.count), 1);

  return (
    <div>
      <h3 className="text-note uppercase tracking-wider text-slate-500 px-2 mb-1.5">
        Goals — tasks mapped, done vs. planned
      </h3>
      <div className="space-y-1.5 px-2">
        {stats.map(({ goal, done, count }) => (
          <div key={goal.id} className="group">
            <div className="flex items-center gap-1.5 text-label">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: goal.color }}
              />
              <span className="text-slate-300 truncate flex-1">{goal.name}</span>
              <span className="text-slate-500 tabular-nums">
                {count > 0 ? `${done} / ${count}` : "—"}
              </span>
              <button
                onClick={() => deleteGoal(goal.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-note"
                title="delete goal"
              >
                ✕
              </button>
            </div>
            <div className="h-1 rounded-full bg-slate-800 mt-0.5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(count / max) * 100}%`,
                  backgroundColor: goal.color,
                  opacity: 0.7,
                }}
              />
            </div>
          </div>
        ))}
        {unmapped > 0 && (
          <p className="text-note text-slate-600">
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
          className="w-full bg-transparent border-b border-slate-800 focus:border-lagoon-500 outline-none px-0.5 py-1 text-label text-slate-300 placeholder:text-slate-600"
        />
      </div>
    </div>
  );
}
