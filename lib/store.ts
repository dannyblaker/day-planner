"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { arrangeByDepth, columnX, rowY } from "./flow";
import { dependentsOf, flowDepths } from "./graph";
import { parseQuickAdd } from "./parse";
import { FLOW, GOAL_COLORS, Goal, Plan, Priority, Task } from "./types";

const uid = () => crypto.randomUUID().slice(0, 8);

function defaultPlan(): Plan {
  const goals: Goal[] = [
    { id: uid(), name: "deep-work", color: GOAL_COLORS[0] },
    { id: uid(), name: "admin", color: GOAL_COLORS[1] },
  ];
  const mk = (partial: Partial<Task>, order: number): Task => ({
    id: uid(),
    title: "",
    duration: 30,
    priority: 3,
    dependsOn: [],
    done: false,
    order,
    createdAt: Date.now(),
    ...partial,
  });
  const draft = mk(
    { title: "Draft project proposal", duration: 60, priority: 1, goalId: goals[0].id },
    1
  );
  return {
    goals,
    tasks: [
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
        { title: "CI pipeline run (background)", duration: 45, parallel: true, priority: 3 },
        3
      ),
      mk(
        {
          title: "Press ? for shortcuts — try adding a task with N",
          duration: 15,
          priority: 4,
          goalId: goals[1].id,
        },
        4
      ),
    ],
    shareToken: uid() + uid(),
  };
}

/** Snapshot of a bulk clear, kept only long enough to offer an undo. */
interface ClearedBatch {
  tasks: Task[];
  /** dependsOn links that pointed at the cleared tasks: dependent id → dep ids */
  deps: Record<string, string[]>;
}

interface AppState {
  plan: Plan;
  selectedId: string | null;
  editorOpen: boolean;
  helpOpen: boolean;
  loaded: boolean;
  saving: boolean;
  lastCleared: ClearedBatch | null;
  /** a standing request for the canvas to open its new-task input, with the
   *  new task depending on `sourceId`. The nonce is what makes a second press
   *  of the same key on the same task a second request. */
  newTaskFrom: { sourceId: string; nonce: number } | null;
  requestNewTaskFrom: (sourceId: string) => void;
  /** assign flowchart positions to tasks that don't have one yet */
  ensureFlowPositions: () => void;
  /** re-layout the whole flowchart by dependency depth */
  autoArrangeFlow: () => void;

  load: (plan: Plan | null) => void;
  setSaving: (v: boolean) => void;
  select: (id: string | null) => void;
  setEditorOpen: (v: boolean) => void;
  setHelpOpen: (v: boolean) => void;

  quickAdd: (input: string) => string | null;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, dir: -1 | 1) => void;
  /** drag & drop: re-insert task before another task (null = end of queue) */
  placeBefore: (id: string, beforeId: string | null) => void;
  setDone: (id: string, done: boolean) => void;
  /** the `d` key and every done button in the UI */
  toggleDone: (id: string) => void;
  toggleBlocked: (id: string, reason?: string) => void;
  setPriority: (id: string, p: Priority) => void;
  adjustDuration: (id: string, delta: number) => void;
  autoSort: () => void;
  /** remove the finished tasks; recoverable until the undo bar goes */
  clearDone: () => void;
  undoClear: () => void;
  dismissUndo: () => void;
  addGoal: (name: string) => void;
  deleteGoal: (id: string) => void;
  toggleDependency: (taskId: string, depId: string) => void;
}

/** Does this look like a plan we can use? Anything else gets the seed instead. */
function isPlan(p: unknown): p is Plan {
  return !!p && Array.isArray((p as Plan).tasks) && Array.isArray((p as Plan).goals);
}

export const useApp = create<AppState>()(
  immer((set, get) => ({
    plan: defaultPlan(),
    selectedId: null,
    editorOpen: false,
    helpOpen: false,
    loaded: false,
    saving: false,
    lastCleared: null,
    newTaskFrom: null,

    requestNewTaskFrom: (sourceId) =>
      set((s) => {
        s.newTaskFrom = { sourceId, nonce: (s.newTaskFrom?.nonce ?? 0) + 1 };
      }),

    ensureFlowPositions: () =>
      set((s) => {
        const tasks = s.plan.tasks;
        const missing = tasks.filter((t) => t.flowX == null || t.flowY == null);
        if (!missing.length) return;
        const depths = flowDepths(tasks);
        for (const t of missing) {
          const x = columnX(depths.get(t.id) || 0);
          const maxY = FLOW.H - FLOW.NODE_H - 20;
          const taken = tasks
            .filter(
              (o) =>
                o.id !== t.id &&
                o.flowX != null &&
                Math.abs(o.flowX - x) < FLOW.NODE_W
            )
            .map((o) => o.flowY ?? 0);
          // the same rows auto-arrange uses, and the same clearance the canvas
          // uses when it drops a new dependent beside its prerequisite: a node
          // is as tall as the crocodile drawn in it, so none of this can be a
          // number typed in by hand
          let row = 0;
          let y = rowY(row);
          while (
            taken.some((ty) => Math.abs(ty - y) < FLOW.NODE_H + 12) &&
            y < maxY
          )
            y = rowY(++row);
          t.flowX = x;
          t.flowY = Math.min(y, maxY);
        }
      }),

    autoArrangeFlow: () =>
      set((s) => {
        const layout = arrangeByDepth(s.plan.tasks);
        for (const t of s.plan.tasks) {
          const p = layout.get(t.id);
          if (!p) continue;
          t.flowX = p.x;
          t.flowY = p.y;
        }
      }),

    load: (plan) =>
      set((s) => {
        if (isPlan(plan)) s.plan = plan;
        s.loaded = true;
      }),
    setSaving: (v) => set((s) => void (s.saving = v)),
    select: (id) => set((s) => void (s.selectedId = id)),
    setEditorOpen: (v) => set((s) => void (s.editorOpen = v)),
    setHelpOpen: (v) => set((s) => void (s.helpOpen = v)),

    quickAdd: (input) => {
      const parsed = parseQuickAdd(input, get().plan.tasks, get().plan.goals);
      if (!parsed.title) return null;
      const id = uid();
      set((s) => {
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
        const orders = s.plan.tasks.map((t) => t.order);
        const order = parsed.urgent
          ? (orders.length ? Math.min(...orders) : 0) - 1
          : (orders.length ? Math.max(...orders) : 0) + 1;
        s.plan.tasks.push({
          id,
          title: parsed.title,
          duration: parsed.duration,
          priority: parsed.priority,
          goalId,
          dependsOn: parsed.dependsOn,
          blocked: parsed.blocked,
          done: false,
          parallel: parsed.parallel,
          order,
          createdAt: Date.now(),
        });
        s.selectedId = id;
      });
      return id;
    },

    updateTask: (id, patch) =>
      set((s) => {
        const t = s.plan.tasks.find((t) => t.id === id);
        if (t) Object.assign(t, patch);
      }),

    deleteTask: (id) =>
      set((s) => {
        s.plan.tasks = s.plan.tasks.filter((t) => t.id !== id);
        for (const t of s.plan.tasks)
          t.dependsOn = t.dependsOn.filter((dep) => dep !== id);
        if (s.selectedId === id) {
          s.selectedId = null;
          s.editorOpen = false;
        }
      }),

    moveTask: (id, dir) =>
      set((s) => {
        const queue = s.plan.tasks
          .filter((t) => !t.done && !t.blocked)
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
        const sorted = [...s.plan.tasks].sort((a, b) => a.order - b.order);
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

    /** Marking a task done is what advances the frontier: its dependents stop
     *  waiting and become in-progress on the next render, with nothing stored. */
    setDone: (id, done) =>
      set((s) => {
        const t = s.plan.tasks.find((t) => t.id === id);
        if (t) t.done = done;
      }),

    toggleDone: (id) => {
      const t = get().plan.tasks.find((t) => t.id === id);
      if (t) get().setDone(id, !t.done);
    },

    toggleBlocked: (id, reason) =>
      set((s) => {
        const t = s.plan.tasks.find((t) => t.id === id);
        if (!t) return;
        t.blocked = t.blocked ? null : reason || "Blocked";
      }),

    setPriority: (id, p) =>
      set((s) => {
        const t = s.plan.tasks.find((t) => t.id === id);
        if (t) t.priority = p;
      }),

    adjustDuration: (id, delta) =>
      set((s) => {
        const t = s.plan.tasks.find((t) => t.id === id);
        if (t) t.duration = Math.max(5, t.duration + delta);
      }),

    autoSort: () =>
      set((s) => {
        const queue = s.plan.tasks
          .filter((t) => !t.done && !t.blocked)
          .sort((a, b) => a.order - b.order);
        const orders = queue.map((t) => t.order).sort((a, b) => a - b);
        const sorted = [...queue].sort(
          (a, b) => a.priority - b.priority || a.order - b.order
        );
        sorted.forEach((t, i) => (t.order = orders[i]));
      }),

    clearDone: () =>
      set((s) => {
        // plain copies, so the snapshot outlives the drafts they came from
        const removed = s.plan.tasks
          .filter((t) => t.done)
          .map((t) => ({ ...t, dependsOn: [...t.dependsOn] }));
        if (!removed.length) return;

        const ids = new Set(removed.map((t) => t.id));
        const deps: Record<string, string[]> = {};
        s.plan.tasks = s.plan.tasks.filter((t) => !ids.has(t.id));
        for (const t of s.plan.tasks) {
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
        s.lastCleared = { tasks: removed, deps };
      }),

    /** Puts the batch back where it came from. Only the cleared tasks and their
     *  links are touched, so edits made in the meantime survive. */
    undoClear: () =>
      set((s) => {
        const batch = s.lastCleared;
        if (!batch) return;
        const present = new Set(s.plan.tasks.map((t) => t.id));
        for (const t of batch.tasks) if (!present.has(t.id)) s.plan.tasks.push(t);
        for (const [id, deps] of Object.entries(batch.deps)) {
          const t = s.plan.tasks.find((x) => x.id === id);
          if (!t) continue;
          for (const dep of deps) if (!t.dependsOn.includes(dep)) t.dependsOn.push(dep);
        }
        s.lastCleared = null;
      }),

    dismissUndo: () => set((s) => void (s.lastCleared = null)),

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
        for (const t of s.plan.tasks) if (t.goalId === id) t.goalId = null;
      }),

    toggleDependency: (taskId, depId) =>
      set((s) => {
        const t = s.plan.tasks.find((t) => t.id === taskId);
        if (!t || taskId === depId) return;
        if (t.dependsOn.includes(depId)) {
          t.dependsOn = t.dependsOn.filter((x) => x !== depId);
        } else {
          // prevent cycles: depId must not depend on taskId
          if (dependentsOf(s.plan.tasks, taskId).has(depId)) return;
          t.dependsOn.push(depId);
        }
      }),
  }))
);
