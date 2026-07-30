"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { parseQuickAdd } from "./parse";
import { dependentsOf, flowDepths } from "./scheduler";
import { nowMinutes, todayISO, addDaysISO } from "./time";
import {
  DayPlan,
  FLOW,
  GOAL_COLORS,
  Goal,
  Plan,
  Priority,
  Task,
  emptyDay,
} from "./types";

const uid = () => crypto.randomUUID().slice(0, 8);

function defaultPlan(): Plan {
  const goals: Goal[] = [
    { id: uid(), name: "deep-work", color: GOAL_COLORS[0] },
    { id: uid(), name: "admin", color: GOAL_COLORS[1] },
  ];
  const date = todayISO();
  const day = emptyDay(date);
  const mk = (partial: Partial<Task>, order: number): Task => ({
    id: uid(),
    title: "",
    duration: 30,
    priority: 3,
    dependsOn: [],
    status: "todo",
    order,
    actualMinutes: 0,
    createdAt: Date.now(),
    ...partial,
  });
  const draft = mk(
    { title: "Draft project proposal", duration: 60, priority: 1, goalId: goals[0].id },
    1
  );
  day.tasks = [
    draft,
    mk(
      {
        title: "Review proposal with fresh eyes",
        duration: 20,
        priority: 2,
        goalId: goals[0].id,
        dependsOn: [draft.id],
      },
      2
    ),
    mk(
      { title: "Team stand-up", duration: 15, priority: 2, fixedStart: 10 * 60 },
      3
    ),
    mk(
      { title: "CI pipeline run (background)", duration: 45, parallel: true, priority: 3 },
      4
    ),
    mk(
      { title: "Press ? for shortcuts — try adding a task with N", duration: 15, priority: 4, goalId: goals[1].id },
      5
    ),
  ];
  return { goals, days: { [date]: day }, shareToken: uid() + uid() };
}

/** Snapshot of a bulk clear, kept only long enough to offer an undo. */
interface ClearedBatch {
  date: string;
  tasks: Task[];
  /** dependsOn links that pointed at the cleared tasks: dependent id → dep ids */
  deps: Record<string, string[]>;
}

/** Snapshot of a cross-day move, kept only long enough to offer an undo. */
interface MovedTask {
  /** the task exactly as it was before the move */
  task: Task;
  from: string;
  to: string;
  /** ids of tasks on `from` that depended on it */
  dependents: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface AppState {
  plan: Plan;
  date: string;
  selectedId: string | null;
  editorOpen: boolean;
  helpOpen: boolean;
  loaded: boolean;
  saving: boolean;
  lastCleared: ClearedBatch | null;
  lastMoved: MovedTask | null;
  view: "timeline" | "flow";
  setView: (v: "timeline" | "flow") => void;
  /** assign flowchart positions to tasks that don't have one yet */
  ensureFlowPositions: () => void;
  /** re-layout the whole flowchart by dependency depth */
  autoArrangeFlow: () => void;

  load: (plan: Plan | null) => void;
  setSaving: (v: boolean) => void;
  setDate: (date: string) => void;
  shiftDate: (delta: number) => void;
  select: (id: string | null) => void;
  setEditorOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;

  quickAdd: (input: string) => string | null;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, dir: -1 | 1) => void;
  /** drag & drop: re-insert task before another task (null = end of queue) */
  placeBefore: (id: string, beforeId: string | null) => void;
  startTask: (id: string) => void;
  pauseTask: (id: string) => void;
  completeTask: (id: string) => void;
  reopenTask: (id: string) => void;
  /** done ⇄ todo, for the `d` key and every done button in the UI */
  toggleDone: (id: string) => void;
  toggleBlocked: (id: string, reason?: string) => void;
  setPriority: (id: string, p: Priority) => void;
  adjustDuration: (id: string, delta: number) => void;
  autoSort: () => void;
  /** remove this day's finished tasks; recoverable until the undo bar goes */
  clearDone: () => void;
  undoClear: () => void;
  dismissUndo: () => void;
  /** move a task to any other day, keeping it as it is (pin included) */
  moveTaskToDate: (id: string, date: string) => void;
  undoMove: () => void;
  dismissMove: () => void;
  /** whichever of the two pending offers is on the table (the `u` key) */
  undoLast: () => void;
  deferToNextDay: (id: string) => void;
  setDayBounds: (start: number, end: number) => void;
  addGoal: (name: string) => void;
  deleteGoal: (id: string) => void;
  toggleDependency: (taskId: string, depId: string) => void;
}

function day(state: { plan: Plan; date: string }): DayPlan {
  let d = state.plan.days[state.date];
  if (!d) {
    d = emptyDay(state.date);
    state.plan.days[state.date] = d;
  }
  return d;
}

/** The slice of the state a cross-day move touches. */
interface MoveCtx {
  plan: Plan;
  date: string;
  selectedId: string | null;
  editorOpen: boolean;
  lastCleared: ClearedBatch | null;
  lastMoved: MovedTask | null;
}

/**
 * Take a task off the day on screen and append it to `date`.
 *
 * Dependencies are day-local, so links in both directions go (recorded, so the
 * undo can put them back). The two modes differ in how much of the task's own
 * state survives:
 * - "move": reschedule as-is — a pinned meeting keeps its time, a finished task
 *   stays finished. This is the general day-to-day move.
 * - "defer": "I didn't get to this" — back to todo, and the pin is dropped
 *   because it was a time on the day being left behind.
 */
function moveToDate(
  s: MoveCtx,
  id: string,
  date: string,
  mode: "move" | "defer"
) {
  if (!ISO_DATE.test(date) || date === s.date) return;
  const d = day(s);
  const t = d.tasks.find((x) => x.id === id);
  if (!t) return;

  // plain copy, so the undo snapshot outlives the draft it came from
  const before: Task = { ...t, dependsOn: [...t.dependsOn] };
  if (t.status === "active") {
    accumulate(t);
    t.status = "todo";
    t.actualStart = null;
  }
  let target = s.plan.days[date];
  if (!target) {
    target = emptyDay(date);
    s.plan.days[date] = target;
  }
  const orders = target.tasks.map((x) => x.order);
  target.tasks.push({
    ...t,
    dependsOn: [],
    // canvas coordinates belong to the day they were laid out on
    flowX: null,
    flowY: null,
    order: (orders.length ? Math.max(...orders) : 0) + 1,
    ...(mode === "defer"
      ? { status: "todo" as const, actualStart: null, fixedStart: null }
      : {}),
  });

  d.tasks = d.tasks.filter((x) => x.id !== id);
  const dependents: string[] = [];
  for (const x of d.tasks) {
    if (x.dependsOn.includes(id)) {
      dependents.push(x.id);
      x.dependsOn = x.dependsOn.filter((dep) => dep !== id);
    }
  }

  if (s.selectedId === id) {
    s.selectedId = null;
    s.editorOpen = false;
  }
  // only one undo offer at a time
  s.lastCleared = null;
  s.lastMoved = { task: before, from: s.date, to: date, dependents };
}

function accumulate(t: Task) {
  if (t.actualStart != null) {
    t.actualMinutes =
      Math.round(
        ((t.actualMinutes || 0) + Math.max(nowMinutes() - t.actualStart, 0)) * 10
      ) / 10;
  }
}

export const useApp = create<AppState>()(
  immer((set, get) => ({
    plan: defaultPlan(),
    date: todayISO(),
    selectedId: null,
    editorOpen: false,
    helpOpen: false,
    loaded: false,
    saving: false,
    lastCleared: null,
    lastMoved: null,
    view: "timeline",

    setView: (v) => set((s) => void (s.view = v)),

    ensureFlowPositions: () =>
      set((s) => {
        const d = day(s);
        const missing = d.tasks.filter((t) => t.flowX == null || t.flowY == null);
        if (!missing.length) return;
        const depths = flowDepths(d.tasks);
        for (const t of missing) {
          const x = 40 + (depths.get(t.id) || 0) * 250;
          const bandTop = t.parallel ? FLOW.PAR_Y + 50 : 60;
          const bandMax = t.parallel
            ? FLOW.H - FLOW.NODE_H - 20
            : FLOW.PAR_Y - FLOW.NODE_H - 20;
          const taken = d.tasks
            .filter(
              (o) =>
                o.id !== t.id &&
                o.flowX != null &&
                Math.abs(o.flowX - x) < FLOW.NODE_W
            )
            .map((o) => o.flowY ?? 0);
          let y = bandTop;
          while (taken.some((ty) => Math.abs(ty - y) < 90) && y < bandMax)
            y += 100;
          t.flowX = x;
          t.flowY = Math.min(y, bandMax);
        }
      }),

    autoArrangeFlow: () =>
      set((s) => {
        const d = day(s);
        const depths = flowDepths(d.tasks);
        const counters: Record<string, number> = {};
        const sorted = [...d.tasks].sort(
          (a, b) =>
            (depths.get(a.id) || 0) - (depths.get(b.id) || 0) ||
            a.order - b.order
        );
        for (const t of sorted) {
          const dep = depths.get(t.id) || 0;
          const key = (t.parallel ? "p" : "f") + dep;
          const i = (counters[key] = (counters[key] ?? -1) + 1);
          t.flowX = 40 + dep * 250;
          t.flowY = t.parallel ? FLOW.PAR_Y + 50 + i * 100 : 60 + i * 100;
        }
      }),

    load: (plan) =>
      set((s) => {
        if (plan && plan.days) s.plan = plan;
        s.loaded = true;
        day(s);
      }),
    setSaving: (v) => set((s) => void (s.saving = v)),
    setDate: (date) =>
      set((s) => {
        s.date = date;
        s.selectedId = null;
        s.editorOpen = false;
        day(s);
      }),
    shiftDate: (delta) => get().setDate(addDaysISO(get().date, delta)),
    select: (id) => set((s) => void (s.selectedId = id)),
    setEditorOpen: (v) => set((s) => void (s.editorOpen = v)),
    setHelpOpen: (v) => set((s) => void (s.helpOpen = v)),

    quickAdd: (input) => {
      const parsed = parseQuickAdd(
        input,
        day(get()).tasks,
        get().plan.goals
      );
      if (!parsed.title) return null;
      const id = uid();
      set((s) => {
        const d = day(s);
        let goalId: string | null = null;
        if (parsed.goalName) {
          let g = s.plan.goals.find(
            (g) => g.name.toLowerCase() === parsed.goalName!.toLowerCase()
          );
          if (!g) {
            g = {
              id: uid(),
              name: parsed.goalName,
              color: GOAL_COLORS[s.plan.goals.length % GOAL_COLORS.length],
            };
            s.plan.goals.push(g);
          }
          goalId = g.id;
        }
        const orders = d.tasks.map((t) => t.order);
        const order = parsed.urgent
          ? (orders.length ? Math.min(...orders) : 0) - 1
          : (orders.length ? Math.max(...orders) : 0) + 1;
        d.tasks.push({
          id,
          title: parsed.title,
          duration: parsed.duration,
          priority: parsed.priority,
          goalId,
          dependsOn: parsed.dependsOn,
          blocked: parsed.blocked,
          status: "todo",
          fixedStart: parsed.fixedStart ?? null,
          parallel: parsed.parallel,
          order,
          actualStart: null,
          actualMinutes: 0,
          createdAt: Date.now(),
        });
        s.selectedId = id;
      });
      return id;
    },

    updateTask: (id, patch) =>
      set((s) => {
        const t = day(s).tasks.find((t) => t.id === id);
        if (t) Object.assign(t, patch);
      }),

    deleteTask: (id) =>
      set((s) => {
        const d = day(s);
        d.tasks = d.tasks.filter((t) => t.id !== id);
        for (const t of d.tasks)
          t.dependsOn = t.dependsOn.filter((dep) => dep !== id);
        if (s.selectedId === id) {
          s.selectedId = null;
          s.editorOpen = false;
        }
      }),

    moveTask: (id, dir) =>
      set((s) => {
        const queue = day(s)
          .tasks.filter((t) => t.status === "todo" && !t.blocked)
          .sort((a, b) => a.order - b.order);
        const i = queue.findIndex((t) => t.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= queue.length) return;
        const a = queue[i].order;
        queue[i].order = queue[j].order;
        queue[j].order = a;
      }),

    placeBefore: (id, beforeId) =>
      set((s) => {
        if (id === beforeId) return;
        const d = day(s);
        const sorted = [...d.tasks].sort((a, b) => a.order - b.order);
        const from = sorted.findIndex((t) => t.id === id);
        if (from < 0) return;
        const [t] = sorted.splice(from, 1);
        let idx = beforeId
          ? sorted.findIndex((x) => x.id === beforeId)
          : sorted.length;
        if (idx < 0) idx = sorted.length;
        sorted.splice(idx, 0, t);
        sorted.forEach((x, i) => (x.order = i));
      }),

    startTask: (id) =>
      set((s) => {
        for (const t of day(s).tasks) {
          if (t.status === "active" && t.id !== id) {
            accumulate(t);
            t.status = "todo";
            t.actualStart = null;
          }
        }
        const t = day(s).tasks.find((t) => t.id === id);
        if (!t) return;
        t.status = "active";
        t.blocked = null;
        t.actualStart = nowMinutes();
      }),

    pauseTask: (id) =>
      set((s) => {
        const t = day(s).tasks.find((t) => t.id === id);
        if (!t || t.status !== "active") return;
        accumulate(t);
        t.status = "todo";
        t.actualStart = null;
      }),

    completeTask: (id) =>
      set((s) => {
        const t = day(s).tasks.find((t) => t.id === id);
        if (!t) return;
        if (t.status === "active") accumulate(t);
        t.status = "done";
      }),

    reopenTask: (id) =>
      set((s) => {
        const t = day(s).tasks.find((t) => t.id === id);
        if (!t) return;
        t.status = "todo";
        t.actualStart = null;
      }),

    toggleDone: (id) => {
      const t = day(get()).tasks.find((t) => t.id === id);
      if (!t) return;
      if (t.status === "done") get().reopenTask(id);
      else get().completeTask(id);
    },

    toggleBlocked: (id, reason) =>
      set((s) => {
        const t = day(s).tasks.find((t) => t.id === id);
        if (!t) return;
        if (t.blocked) t.blocked = null;
        else {
          if (t.status === "active") {
            accumulate(t);
            t.actualStart = null;
          }
          t.status = "todo";
          t.blocked = reason || "Blocked";
        }
      }),

    setPriority: (id, p) =>
      set((s) => {
        const t = day(s).tasks.find((t) => t.id === id);
        if (t) t.priority = p;
      }),

    adjustDuration: (id, delta) =>
      set((s) => {
        const t = day(s).tasks.find((t) => t.id === id);
        if (t) t.duration = Math.max(5, t.duration + delta);
      }),

    autoSort: () =>
      set((s) => {
        const queue = day(s)
          .tasks.filter((t) => t.status === "todo" && !t.blocked)
          .sort((a, b) => a.order - b.order);
        const orders = queue.map((t) => t.order).sort((a, b) => a - b);
        const sorted = [...queue].sort(
          (a, b) => a.priority - b.priority || a.order - b.order
        );
        sorted.forEach((t, i) => (t.order = orders[i]));
      }),

    clearDone: () =>
      set((s) => {
        const d = day(s);
        // plain copies, so the snapshot outlives the drafts they came from
        const removed = d.tasks
          .filter((t) => t.status === "done")
          .map((t) => ({ ...t, dependsOn: [...t.dependsOn] }));
        if (!removed.length) return;

        const ids = new Set(removed.map((t) => t.id));
        const deps: Record<string, string[]> = {};
        d.tasks = d.tasks.filter((t) => !ids.has(t.id));
        for (const t of d.tasks) {
          const lost = t.dependsOn.filter((id) => ids.has(id));
          if (lost.length) {
            deps[t.id] = lost;
            t.dependsOn = t.dependsOn.filter((id) => !ids.has(id));
          }
        }
        if (s.selectedId && ids.has(s.selectedId)) {
          s.selectedId = null;
          s.editorOpen = false;
        }
        s.lastMoved = null; // only one undo offer at a time
        s.lastCleared = { date: s.date, tasks: removed, deps };
      }),

    /** Puts the batch back where it came from, whatever day is on screen now.
     *  Only the cleared tasks and their links are touched, so edits made in
     *  the meantime survive. */
    undoClear: () =>
      set((s) => {
        const batch = s.lastCleared;
        if (!batch) return;
        let d = s.plan.days[batch.date];
        if (!d) {
          d = emptyDay(batch.date);
          s.plan.days[batch.date] = d;
        }
        const present = new Set(d.tasks.map((t) => t.id));
        for (const t of batch.tasks) if (!present.has(t.id)) d.tasks.push(t);
        for (const [id, deps] of Object.entries(batch.deps)) {
          const t = d.tasks.find((x) => x.id === id);
          if (!t) continue;
          for (const dep of deps) if (!t.dependsOn.includes(dep)) t.dependsOn.push(dep);
        }
        s.lastCleared = null;
      }),

    dismissUndo: () => set((s) => void (s.lastCleared = null)),

    moveTaskToDate: (id, date) =>
      set((s) => moveToDate(s, id, date, "move")),

    /** Takes the task back to the day it came from, links included. */
    undoMove: () =>
      set((s) => {
        const m = s.lastMoved;
        if (!m) return;
        const target = s.plan.days[m.to];
        if (target) target.tasks = target.tasks.filter((t) => t.id !== m.task.id);
        let src = s.plan.days[m.from];
        if (!src) {
          src = emptyDay(m.from);
          s.plan.days[m.from] = src;
        }
        if (!src.tasks.some((t) => t.id === m.task.id)) src.tasks.push(m.task);
        for (const id of m.dependents) {
          const t = src.tasks.find((x) => x.id === id);
          if (t && !t.dependsOn.includes(m.task.id)) t.dependsOn.push(m.task.id);
        }
        s.lastMoved = null;
      }),

    dismissMove: () => set((s) => void (s.lastMoved = null)),

    undoLast: () => {
      if (get().lastMoved) get().undoMove();
      else get().undoClear();
    },

    deferToNextDay: (id) =>
      set((s) => moveToDate(s, id, addDaysISO(s.date, 1), "defer")),

    setDayBounds: (start, end) =>
      set((s) => {
        const d = day(s);
        d.dayStart = start;
        d.dayEnd = Math.max(end, start + 60);
      }),

    addGoal: (name) =>
      set((s) => {
        if (!name.trim()) return;
        if (
          s.plan.goals.some(
            (g) => g.name.toLowerCase() === name.trim().toLowerCase()
          )
        )
          return;
        s.plan.goals.push({
          id: uid(),
          name: name.trim(),
          color: GOAL_COLORS[s.plan.goals.length % GOAL_COLORS.length],
        });
      }),

    deleteGoal: (id) =>
      set((s) => {
        s.plan.goals = s.plan.goals.filter((g) => g.id !== id);
        for (const d of Object.values(s.plan.days))
          for (const t of d.tasks) if (t.goalId === id) t.goalId = null;
      }),

    toggleDependency: (taskId, depId) =>
      set((s) => {
        const d = day(s);
        const t = d.tasks.find((t) => t.id === taskId);
        if (!t || taskId === depId) return;
        if (t.dependsOn.includes(depId)) {
          t.dependsOn = t.dependsOn.filter((x) => x !== depId);
        } else {
          // prevent cycles: depId must not depend on taskId
          if (dependentsOf(d.tasks, taskId).has(depId)) return;
          t.dependsOn.push(depId);
        }
      }),
  }))
);
