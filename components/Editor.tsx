"use client";

import { dependentsOf } from "@/lib/scheduler";
import { useApp } from "@/lib/store";
import { fmtTime } from "@/lib/time";
import { Priority } from "@/lib/types";
import { PRIORITY_COLOR } from "./Timeline";

const field =
  "w-full bg-slate-800 border border-slate-700 focus:border-indigo-500 outline-none rounded px-2 py-1.5 text-[13px] text-slate-200";
const label = "text-[10px] uppercase tracking-wider text-slate-500 mb-1 block";

export default function Editor() {
  const day = useApp((s) => s.plan.days[s.date]);
  const goals = useApp((s) => s.plan.goals);
  const selectedId = useApp((s) => s.selectedId);
  const open = useApp((s) => s.editorOpen);
  const {
    updateTask,
    deleteTask,
    setEditorOpen,
    toggleDependency,
    deferToNextDay,
  } = useApp();

  const task = day?.tasks.find((t) => t.id === selectedId);
  if (!open || !task || !day) return null;

  const others = day.tasks.filter((t) => t.id !== task.id);
  const wouldCycle = dependentsOf(day.tasks, task.id);

  return (
    <aside className="w-72 shrink-0 border-l border-slate-800 bg-slate-900/60 p-3 overflow-y-auto space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] uppercase tracking-wider text-slate-500">
          Edit task
        </h2>
        <button
          onClick={() => setEditorOpen(false)}
          className="text-slate-500 hover:text-slate-300 text-sm"
          title="close (esc)"
        >
          ✕
        </button>
      </div>

      <div>
        <label className={label}>Title</label>
        <input
          className={field}
          value={task.title}
          onChange={(e) => updateTask(task.id, { title: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>

      <div>
        <label className={label}>Notes</label>
        <textarea
          className={`${field} h-16 resize-none`}
          value={task.notes || ""}
          onChange={(e) => updateTask(task.id, { notes: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className={label}>Duration (min)</label>
          <input
            type="number"
            min={5}
            step={5}
            className={field}
            value={task.duration}
            onChange={(e) =>
              updateTask(task.id, {
                duration: Math.max(5, parseInt(e.target.value) || 5),
              })
            }
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <div className="flex-1">
          <label className={label}>Priority</label>
          <div className="flex gap-1">
            {([1, 2, 3, 4] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => updateTask(task.id, { priority: p })}
                className={`flex-1 text-xs py-1.5 rounded border ${
                  task.priority === p
                    ? "border-slate-400 bg-slate-700"
                    : "border-slate-700 bg-slate-800 hover:bg-slate-700"
                }`}
                style={{ color: PRIORITY_COLOR[p] }}
              >
                P{p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className={label}>Goal</label>
        <select
          className={field}
          value={task.goalId || ""}
          onChange={(e) =>
            updateTask(task.id, { goalId: e.target.value || null })
          }
        >
          <option value="">— none —</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className={label}>Fixed start (meetings)</label>
          <input
            type="time"
            className={field}
            value={task.fixedStart != null ? fmtTime(task.fixedStart) : ""}
            onChange={(e) => {
              if (!e.target.value) return updateTask(task.id, { fixedStart: null });
              const [h, m] = e.target.value.split(":").map(Number);
              updateTask(task.id, { fixedStart: h * 60 + (m || 0) });
            }}
          />
        </div>
        {task.fixedStart != null && (
          <button
            onClick={() => updateTask(task.id, { fixedStart: null })}
            className="btn mb-0.5"
          >
            clear
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!task.parallel}
            onChange={(e) => updateTask(task.id, { parallel: e.target.checked })}
            className="accent-indigo-500"
          />
          ∥ runs in parallel
        </label>
      </div>

      <div>
        <label className={label}>Blocked</label>
        <input
          className={field}
          placeholder="reason (empty = not blocked)"
          value={task.blocked || ""}
          onChange={(e) =>
            updateTask(task.id, { blocked: e.target.value || null })
          }
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>

      {others.length > 0 && (
        <div>
          <label className={label}>Depends on (must finish first)</label>
          <div className="space-y-0.5 max-h-36 overflow-y-auto border border-slate-800 rounded p-1.5">
            {others.map((o) => {
              const disabled = wouldCycle.has(o.id);
              return (
                <label
                  key={o.id}
                  className={`flex items-center gap-1.5 text-[11px] ${
                    disabled
                      ? "text-slate-700 cursor-not-allowed"
                      : "text-slate-300 cursor-pointer"
                  }`}
                  title={disabled ? "would create a dependency cycle" : ""}
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={task.dependsOn.includes(o.id)}
                    onChange={() => toggleDependency(task.id, o.id)}
                    className="accent-indigo-500"
                  />
                  <span className="truncate">{o.title}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => deferToNextDay(task.id)}
          className="btn flex-1"
          title="move to tomorrow (o)"
        >
          → tomorrow
        </button>
        <button
          onClick={() => deleteTask(task.id)}
          className="text-xs px-2 py-1 rounded border border-red-900 text-red-400 hover:bg-red-950"
        >
          delete
        </button>
      </div>
    </aside>
  );
}
