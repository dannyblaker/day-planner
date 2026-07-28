import { DayPlan, Plan, Task } from "@/lib/types";

/** Fixtures with stable ids, so assertions can name tasks directly. */

let seq = 0;
export function resetFactory() {
  seq = 0;
}

export const at = (h: number, m = 0) => h * 60 + m;

export function makeTask(partial: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    duration: 30,
    priority: 3,
    dependsOn: [],
    status: "todo",
    order: seq,
    actualMinutes: 0,
    createdAt: 1_700_000_000_000 + seq,
    ...partial,
  };
}

export function makeDay(tasks: Task[] = [], partial: Partial<DayPlan> = {}): DayPlan {
  return {
    date: "2026-07-28",
    dayStart: at(8),
    dayEnd: at(18),
    tasks,
    ...partial,
  };
}

export function makePlan(days: DayPlan[] = [makeDay()], partial: Partial<Plan> = {}): Plan {
  return {
    goals: [{ id: "g1", name: "deep-work", color: "#818cf8" }],
    days: Object.fromEntries(days.map((d) => [d.date, d])),
    shareToken: "share-token",
    ...partial,
  };
}
