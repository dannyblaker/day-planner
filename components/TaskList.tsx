"use client";

import { useApp } from "@/lib/store";
import { fmtDur, todayISO } from "@/lib/time";
import { Goal, PRIORITY_COLOR, Task } from "@/lib/types";
import DayPicker from "./DayPicker";
import { useRef, useState } from "react";

function Row({
  task,
  goal,
  selected,
}: {
  task: Task;
  goal?: Goal;
  selected: boolean;
}) {
  const { select, setEditorOpen, startTask, pauseTask, toggleDone } = useApp();
  const done = task.status === "done";
  const active = task.status === "active";

  return (
    <div
      data-task-row={task.id}
      onClick={() => select(task.id)}
      onDoubleClick={() => {
        select(task.id);
        setEditorOpen(true);
      }}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer border ${
        selected
          ? "border-indigo-400/70 bg-indigo-950/40"
          : "border-transparent hover:bg-slate-800/60"
      } ${done ? "opacity-50" : ""}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleDone(task.id);
        }}
        role="checkbox"
        aria-checked={done}
        aria-label={task.title}
        className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center text-[9px] ${
          done
            ? "bg-emerald-500/80 border-emerald-500 text-slate-950"
            : "border-slate-500 hover:border-emerald-400"
        }`}
        title={done ? "reopen" : "mark done (d)"}
      >
        {done ? "✓" : ""}
      </button>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
        title={`P${task.priority}`}
      />
      <div className="min-w-0 flex-1">
        <div
          className={`text-[13px] truncate ${
            done ? "line-through text-slate-500" : "text-slate-200"
          }`}
        >
          {active && <span className="text-emerald-400">▶ </span>}
          {task.title}
        </div>
        <div className="text-[10px] text-slate-500 flex gap-1.5 items-center flex-wrap">
          <span>{fmtDur(task.duration)}</span>
          {task.parallel && <span title="runs in parallel">∥</span>}
          {task.dependsOn.length > 0 && (
            <span title="has dependencies">⛓ {task.dependsOn.length}</span>
          )}
          {task.blocked && (
            <span className="text-red-400" title={task.blocked}>
              ⛔ {task.blocked}
            </span>
          )}
          {goal && (
            <span
              className="px-1 rounded-full"
              style={{ backgroundColor: goal.color + "33", color: goal.color }}
            >
              {goal.name}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {!done && !task.blocked && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (active) pauseTask(task.id);
              else startTask(task.id);
            }}
            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            {active ? "pause" : "start"}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleDone(task.id);
          }}
          title={done ? "reopen (d)" : "mark done (d)"}
          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-emerald-600 text-slate-200"
        >
          {done ? "↺ reopen" : "✓ done"}
        </button>
      </div>
    </div>
  );
}

export default function TaskList() {
  const day = useApp((s) => s.plan.days[s.date]);
  const date = useApp((s) => s.date);
  const goals = useApp((s) => s.plan.goals);
  const selectedId = useApp((s) => s.selectedId);
  const placeBefore = useApp((s) => s.placeBefore);
  const clearDone = useApp((s) => s.clearDone);
  const moveUnfinishedToDate = useApp((s) => s.moveUnfinishedToDate);
  const [showDone, setShowDone] = useState(true);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveDate, setMoveDate] = useState(todayISO());
  // drag & drop: id to insert before; null = end of queue; undefined = not dragging
  const [dropBefore, setDropBefore] = useState<string | null | undefined>(undefined);
  const dragId = useRef<string | null>(null);
  if (!day) return null;

  const queue = day.tasks
    .filter((t) => (t.status === "todo" || t.status === "active") && !t.blocked)
    .sort((a, b) => a.order - b.order);
  const blocked = day.tasks.filter((t) => t.blocked && t.status !== "done");
  const done = day.tasks.filter((t) => t.status === "done");
  const unfinished = day.tasks.filter((t) => t.status !== "done");
  const goalOf = (t: Task) => goals.find((g) => g.id === t.goalId);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline gap-2 px-2 mb-1">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500">
            Queue · {queue.length}
          </h3>
          <div className="flex-1" />
          {unfinished.length > 0 && (
            <button
              onClick={() => setMoveOpen(!moveOpen)}
              aria-expanded={moveOpen}
              className={`text-[10px] ${
                moveOpen ? "text-indigo-300" : "text-slate-600 hover:text-indigo-300"
              }`}
              title="move this day's unfinished work to another day, dependencies and all"
            >
              move all →
            </button>
          )}
        </div>
        {moveOpen && (
          <div className="px-2 pb-2">
            <DayPicker
              ariaLabel="Move all unfinished tasks to"
              value={moveDate}
              from={date}
              onChange={setMoveDate}
            >
              <button
                onClick={() => {
                  moveUnfinishedToDate(moveDate);
                  setMoveOpen(false);
                }}
                disabled={!moveDate || moveDate === date}
                className="btn"
                title={
                  moveDate === date
                    ? "that is the day they are already on"
                    : "dependencies between them survive the move"
                }
              >
                move {unfinished.length} →
              </button>
            </DayPicker>
          </div>
        )}
        <div
          className="space-y-0.5"
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDropBefore(undefined);
          }}
        >
          {queue.map((t, i) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => {
                dragId.current = t.id;
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", t.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const r = e.currentTarget.getBoundingClientRect();
                const before = e.clientY < r.top + r.height / 2;
                setDropBefore(before ? t.id : queue[i + 1]?.id ?? null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId.current && dropBefore !== undefined)
                  placeBefore(dragId.current, dropBefore);
                dragId.current = null;
                setDropBefore(undefined);
              }}
              onDragEnd={() => {
                dragId.current = null;
                setDropBefore(undefined);
              }}
            >
              {dropBefore === t.id && (
                <div className="border-t-2 border-indigo-400 rounded-full mx-2" />
              )}
              <Row task={t} goal={goalOf(t)} selected={selectedId === t.id} />
            </div>
          ))}
          {dropBefore === null && (
            <div className="border-t-2 border-indigo-400 rounded-full mx-2" />
          )}
          {queue.length === 0 && (
            <p className="text-xs text-slate-600 px-2">
              Nothing queued — press <kbd className="kbd">n</kbd> to add a task.
            </p>
          )}
        </div>
      </div>

      {blocked.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-red-400/80 px-2 mb-1">
            Blocked · {blocked.length}
          </h3>
          <div className="space-y-0.5">
            {blocked.map((t) => (
              <Row
                key={t.id}
                task={t}
                goal={goalOf(t)}
                selected={selectedId === t.id}
              />
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <div className="flex items-baseline gap-2 px-2 mb-1">
            <button
              onClick={() => setShowDone(!showDone)}
              className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300"
            >
              Done · {done.length} {showDone ? "▾" : "▸"}
            </button>
            <button
              onClick={clearDone}
              className="text-[10px] text-slate-600 hover:text-red-400"
              title="remove finished tasks from this day (undoable)"
            >
              clear
            </button>
          </div>
          {showDone && (
            <div className="space-y-0.5">
              {done.map((t) => (
                <Row
                  key={t.id}
                  task={t}
                  goal={goalOf(t)}
                  selected={selectedId === t.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
