import { flowDepths, statuses } from "./graph";
import { Goal, Plan, Task, TaskStatus } from "./types";

/**
 * The plan as the API hands it out.
 *
 * The stored document is deliberately thin — status, depth and dependents are
 * all functions of the graph, and storing them would create a second version of
 * the truth that can disagree with the first. But a caller reading over HTTP
 * has no graph module, so this is where the derivations are spelled out: every
 * task carries the answers, and the edges are listed once more on their own so
 * that "the dependencies" is a thing you can read rather than assemble.
 *
 * Pure, and shared by the export route and the browser's export button, so a
 * file downloaded from the app is byte-for-byte the file the API serves.
 */

/** Bumped when the shape changes in a way an importer would notice. */
export const DOCUMENT_VERSION = 1;

export interface TaskView extends Task {
  /** derived: see statusOf() */
  status: TaskStatus;
  /** derived: longest chain of prerequisites behind this task (0 = none) */
  depth: number;
  /** derived: ids that name this task in their dependsOn */
  dependents: string[];
}

export interface Edge {
  /** the prerequisite */
  from: string;
  /** the task that waits for it */
  to: string;
}

export interface GoalView extends Goal {
  taskCount: number;
  doneCount: number;
}

export interface PlanStats {
  tasks: number;
  goals: number;
  dependencies: number;
  byStatus: Record<TaskStatus, number>;
  blocked: number;
  /** deepest chain in the graph, in tasks */
  longestChain: number;
}

export interface PlanDocument {
  app: "Concurrent Crocodiles";
  version: number;
  exportedAt: string;
  shareToken: string;
  goals: GoalView[];
  tasks: TaskView[];
  dependencies: Edge[];
  stats: PlanStats;
}

export function taskViews(tasks: Task[]): TaskView[] {
  const status = statuses(tasks);
  const depths = flowDepths(tasks);
  const dependents = new Map<string, string[]>();
  for (const t of tasks)
    for (const dep of t.dependsOn)
      dependents.set(dep, [...(dependents.get(dep) ?? []), t.id]);

  return tasks.map((t) => ({
    ...t,
    status: status.get(t.id) ?? "todo",
    depth: depths.get(t.id) ?? 0,
    dependents: dependents.get(t.id) ?? [],
  }));
}

/** Every dependency in the plan, prerequisite → dependent. */
export function dependencyEdges(tasks: Task[]): Edge[] {
  const known = new Set(tasks.map((t) => t.id));
  return tasks.flatMap((t) =>
    t.dependsOn.filter((d) => known.has(d)).map((from) => ({ from, to: t.id }))
  );
}

export function goalViews(plan: Plan): GoalView[] {
  return plan.goals.map((g) => {
    const mine = plan.tasks.filter((t) => t.goalId === g.id);
    const done = mine.filter((t) => t.done);
    return {
      ...g,
      taskCount: mine.length,
      doneCount: done.length,
    };
  });
}

export function planStats(plan: Plan): PlanStats {
  const views = taskViews(plan.tasks);
  const byStatus: Record<TaskStatus, number> = {
    "in-progress": 0,
    todo: 0,
    done: 0,
  };
  for (const t of views) byStatus[t.status] += 1;
  return {
    tasks: plan.tasks.length,
    goals: plan.goals.length,
    dependencies: dependencyEdges(plan.tasks).length,
    byStatus,
    blocked: plan.tasks.filter((t) => !!t.blocked).length,
    longestChain: views.reduce((n, t) => Math.max(n, t.depth + 1), 0),
  };
}

/**
 * The export: everything, derivations included, and enough of a header that a
 * reader can tell what it is. Round-trips through POST /api/import.
 */
export function planDocument(plan: Plan, exportedAt = Date.now()): PlanDocument {
  return {
    app: "Concurrent Crocodiles",
    version: DOCUMENT_VERSION,
    exportedAt: new Date(exportedAt).toISOString(),
    shareToken: plan.shareToken,
    goals: goalViews(plan),
    tasks: taskViews(plan.tasks),
    dependencies: dependencyEdges(plan.tasks),
    stats: planStats(plan),
  };
}
