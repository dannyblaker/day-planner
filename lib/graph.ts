import { Task, TaskStatus } from "./types";

/**
 * The dependency graph, as pure derived state.
 *
 * There is no clock here: the plan is a graph of what has to happen before what,
 * and the questions worth asking of it are which work is startable, how deep a
 * task sits, and what hangs off it.
 */

/**
 * Status, derived rather than stored.
 *
 * Everything whose prerequisites are all done is *in progress* — that is the
 * leftmost column of unfinished work, and it is deliberately more than one task:
 * the point of the board is seeing what you can run at the same time. Finish one
 * and its dependents join the frontier on their own.
 *
 * Two things hold a task at *to do* even so: an unfinished prerequisite, and a
 * blocker, which is a reason you can't start that the graph doesn't know about.
 * A dependency on a task that no longer exists is not one of them — a dangling
 * id would otherwise strand the rest of the graph behind it forever.
 */
export function statusOf(task: Task, byId: Map<string, Task>): TaskStatus {
  if (task.done) return "done";
  if (task.blocked) return "todo";
  const ready = task.dependsOn.every((id) => {
    const dep = byId.get(id);
    return !dep || dep.done;
  });
  return ready ? "in-progress" : "todo";
}

/** statusOf for a whole plan, indexed by task id. */
export function statuses(tasks: Task[]): Map<string, TaskStatus> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return new Map(tasks.map((t) => [t.id, statusOf(t, byId)]));
}

/** dependency depth per task (0 = no prerequisites) — drives flowchart layout. */
export function flowDepths(tasks: Task[]): Map<string, number> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, number>();
  const depth = (t: Task, seen: Set<string>): number => {
    if (memo.has(t.id)) return memo.get(t.id)!;
    if (seen.has(t.id)) return 0;
    seen.add(t.id);
    let d = 0;
    for (const id of t.dependsOn) {
      const dep = byId.get(id);
      if (dep) d = Math.max(d, depth(dep, seen) + 1);
    }
    memo.set(t.id, d);
    return d;
  };
  for (const t of tasks) depth(t, new Set());
  return memo;
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
