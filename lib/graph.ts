import { Task } from "./types";

/**
 * The dependency graph, as pure derived state.
 *
 * There is no clock here: the plan is a graph of what has to happen before what,
 * and the only questions worth asking of it are how deep a task sits and what
 * hangs off it.
 */

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
