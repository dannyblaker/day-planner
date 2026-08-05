import { Priority, Task, TaskStatus } from "./types";

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

/**
 * Work that is finished and finished *with*: every task in a run of connected
 * work where all of it is done.
 *
 * A done task on its own qualifies at once. One with an arrow at either end has
 * to wait for the rest of what it is joined to, and for a reason that is not
 * politeness: delete a task that something still waits on and you cut the arrow,
 * so the task left behind stops saying what it was waiting for. Waiting for the
 * whole run also means a finished chain leaves together instead of being nibbled
 * from one end and leaving strangers behind.
 *
 * Connected in either direction and all the way along: a task is joined to what
 * it waits on, to what waits on it, and to whatever those are joined to. One
 * unfinished task anywhere in the run holds all of it.
 */
export function finishedGroups(tasks: Task[]): Set<string> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const joined = new Map<string, string[]>();
  const join = (a: string, b: string) => {
    const list = joined.get(a);
    if (list) list.push(b);
    else joined.set(a, [b]);
  };
  for (const t of tasks)
    for (const dep of t.dependsOn)
      if (byId.has(dep)) {
        join(t.id, dep);
        join(dep, t.id);
      }

  const seen = new Set<string>();
  const out = new Set<string>();
  for (const t of tasks) {
    if (seen.has(t.id)) continue;
    // the whole run this task belongs to, gathered before it is judged
    const run: string[] = [];
    const queue = [t.id];
    seen.add(t.id);
    while (queue.length) {
      const id = queue.pop()!;
      run.push(id);
      for (const next of joined.get(id) ?? [])
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
    }
    if (run.every((id) => byId.get(id)!.done)) for (const id of run) out.add(id);
  }
  return out;
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

/**
 * The priority a task actually answers to: its own, or that of the most urgent
 * thing waiting on it — whichever is higher.
 *
 * A prerequisite of a P1 is a P1, whatever it says on its own label. Nobody sets
 * this; it is read off the graph, like status, and it is what lifts a whole chain
 * up the canvas together instead of stranding the urgent task above the
 * unremarkable-looking work it is actually waiting for.
 *
 * A cycle contributes nothing rather than hanging: a task already on the path
 * answers with its own priority.
 */
export function urgencies(tasks: Task[]): Map<string, Priority> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const waiting = new Map<string, string[]>();
  for (const t of tasks)
    for (const id of t.dependsOn) {
      const list = waiting.get(id);
      if (list) list.push(t.id);
      else waiting.set(id, [t.id]);
    }

  const memo = new Map<string, Priority>();
  const walk = (t: Task, seen: Set<string>): Priority => {
    const known = memo.get(t.id);
    if (known) return known;
    if (seen.has(t.id)) return t.priority;
    seen.add(t.id);
    let u: Priority = t.priority;
    for (const id of waiting.get(t.id) ?? []) {
      const dependent = byId.get(id);
      if (dependent) u = Math.min(u, walk(dependent, seen)) as Priority;
    }
    memo.set(t.id, u);
    return u;
  };
  for (const t of tasks) walk(t, new Set());
  return memo;
}

/**
 * The first dependency cycle in the graph, as a path of ids that ends where it
 * starts, or null when the graph is acyclic.
 *
 * The UI prevents cycles a link at a time, so it never needs this; the API
 * accepts whole graphs at once and has to say which loop it refused.
 */
export function cycleOf(tasks: Task[]): string[] | null {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const done = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  const visit = (t: Task): string[] | null => {
    if (done.has(t.id)) return null;
    if (onStack.has(t.id)) return [...stack.slice(stack.indexOf(t.id)), t.id];
    stack.push(t.id);
    onStack.add(t.id);
    for (const id of t.dependsOn) {
      const dep = byId.get(id);
      const cycle = dep && visit(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    onStack.delete(t.id);
    done.add(t.id);
    return null;
  };

  for (const t of tasks) {
    const cycle = visit(t);
    if (cycle) return cycle;
  }
  return null;
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
