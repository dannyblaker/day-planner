import { Plan, Task } from "@/lib/types";

/** Fixtures with stable ids, so assertions can name tasks directly. */

let seq = 0;
export function resetFactory() {
  seq = 0;
}

export function makeTask(partial: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    duration: 30,
    priority: 3,
    dependsOn: [],
    done: false,
    order: seq,
    createdAt: 1_700_000_000_000 + seq,
    ...partial,
  };
}

export function makePlan(tasks: Task[] = [], partial: Partial<Plan> = {}): Plan {
  return {
    goals: [{ id: "g1", name: "deep-work", color: "#818cf8" }],
    tasks,
    shareToken: "share-token",
    ...partial,
  };
}
