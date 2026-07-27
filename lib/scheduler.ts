import { DayPlan, Slot, Task } from "./types";

/**
 * Compute the day's schedule as pure derived state.
 *
 * Rules:
 * - Done tasks that were timed keep their actual slot.
 * - The active task runs from its start until now (stretching if overrun).
 * - Fixed-time tasks (meetings) are anchored and block the focus lane.
 * - Flexible tasks pack into the gaps in queue order, from max(now, dayStart),
 *   never before their dependencies finish.
 * - Parallel tasks live in a background lane and may overlap anything.
 * - Blocked tasks are not scheduled; tasks depending on them are scheduled
 *   anyway but flagged with waitingOn.
 *
 * Because the schedule is always recomputed from the queue + current time,
 * adding a spontaneous task or running late automatically reflows the rest.
 */
export function scheduleDay(day: DayPlan, now: number): Slot[] {
  const tasks = [...day.tasks].sort((a, b) => a.order - b.order);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const slots: Slot[] = [];
  const endOf = new Map<string, number>();
  const busy: { start: number; end: number }[] = [];

  const addBusy = (start: number, end: number) => {
    busy.push({ start, end });
    busy.sort((a, b) => a.start - b.start);
  };

  const findGap = (earliest: number, dur: number): number => {
    let s = earliest;
    for (const b of busy) {
      if (s + dur <= b.start + 0.001) break;
      if (b.end > s) s = b.end;
    }
    return s;
  };

  const remaining = (t: Task) =>
    Math.max(t.duration - (t.actualMinutes || 0), 5);

  const push = (slot: Slot) => {
    slots.push({ ...slot, overflow: slot.end > day.dayEnd });
  };

  // 1. Done tasks with a recorded run keep their actual position.
  for (const t of tasks) {
    if (t.status === "done" && t.actualStart != null) {
      const end = t.actualStart + Math.max(t.actualMinutes || t.duration, 2);
      push({
        task: t,
        start: t.actualStart,
        end,
        lane: t.parallel ? "background" : "focus",
        fixed: false,
        overflow: false,
        waitingOn: [],
      });
      endOf.set(t.id, end);
    }
  }

  // 2. The active task occupies now.
  for (const t of tasks) {
    if (t.status !== "active") continue;
    const start = t.actualStart ?? now;
    const end = Math.max(start + remaining(t), now + 1);
    push({
      task: t,
      start,
      end,
      lane: t.parallel ? "background" : "focus",
      fixed: false,
      overflow: false,
      waitingOn: [],
    });
    if (!t.parallel) addBusy(start, end);
    endOf.set(t.id, end);
  }

  // 3. Fixed-time anchors.
  for (const t of tasks) {
    if (t.status !== "todo" || t.fixedStart == null || t.blocked) continue;
    const end = t.fixedStart + t.duration;
    push({
      task: t,
      start: t.fixedStart,
      end,
      lane: t.parallel ? "background" : "focus",
      fixed: true,
      overflow: false,
      waitingOn: [],
    });
    if (!t.parallel) addBusy(t.fixedStart, end);
    endOf.set(t.id, end);
  }

  // 4. Flexible tasks, dependency-aware, in queue order.
  const cursorBase = Math.max(now, day.dayStart);
  const pending = tasks.filter(
    (t) => t.status === "todo" && t.fixedStart == null && !t.blocked
  );

  const place = (t: Task, earliest: number, waitingOn: string[]) => {
    const dur = remaining(t);
    if (t.parallel) {
      const start = earliest;
      push({
        task: t,
        start,
        end: start + dur,
        lane: "background",
        fixed: false,
        overflow: false,
        waitingOn,
      });
      endOf.set(t.id, start + dur);
    } else {
      const start = findGap(earliest, dur);
      push({
        task: t,
        start,
        end: start + dur,
        lane: "focus",
        fixed: false,
        overflow: false,
        waitingOn,
      });
      addBusy(start, start + dur);
      endOf.set(t.id, start + dur);
    }
  };

  let progressed = true;
  while (pending.length && progressed) {
    progressed = false;
    for (let i = 0; i < pending.length; i++) {
      const t = pending[i];
      const deps = t.dependsOn
        .map((id) => byId.get(id))
        .filter((d): d is Task => !!d);
      const unmet = deps.filter((d) => d.status !== "done" && !endOf.has(d.id));
      if (unmet.length) continue;
      const depEnd = Math.max(
        cursorBase,
        ...deps.map((d) => endOf.get(d.id) ?? 0)
      );
      place(t, depEnd, []);
      pending.splice(i, 1);
      i--;
      progressed = true;
    }
  }

  // Leftovers: deps blocked or circular — schedule anyway, flag them.
  for (const t of pending) {
    const deps = t.dependsOn
      .map((id) => byId.get(id))
      .filter((d): d is Task => !!d);
    const unmet = deps.filter((d) => d.status !== "done" && !endOf.has(d.id));
    place(t, cursorBase, unmet.map((d) => d.id));
  }

  return slots;
}

/** Sum of minutes still to do in the focus lane (what actually competes for time). */
export function plannedFocusMinutes(day: DayPlan): number {
  return day.tasks
    .filter(
      (t) => (t.status === "todo" || t.status === "active") && !t.parallel && !t.blocked
    )
    .reduce(
      (sum, t) => sum + Math.max(t.duration - (t.actualMinutes || 0), 0),
      0
    );
}

/** ids of tasks that (transitively) depend on `id` — used to prevent dependency cycles. */
export function dependentsOf(tasks: Task[], id: string): Set<string> {
  const result = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of tasks) {
      if (result.has(t.id)) continue;
      if (t.dependsOn.some((d) => d === id || result.has(d))) {
        result.add(t.id);
        grew = true;
      }
    }
  }
  return result;
}
