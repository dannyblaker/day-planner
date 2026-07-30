export type Priority = 1 | 2 | 3 | 4;
export type TaskStatus = "todo" | "active" | "done";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  /** planned minutes */
  duration: number;
  priority: Priority;
  goalId?: string | null;
  dependsOn: string[];
  /** blocker reason; non-null means blocked */
  blocked?: string | null;
  status: TaskStatus;
  /** background lane: runs concurrently with focus work (laundry, CI, waiting) */
  parallel?: boolean;
  order: number;
  /** minutes since midnight when the current/last timer segment started */
  actualStart?: number | null;
  /** accumulated worked minutes across timer segments */
  actualMinutes: number;
  createdAt: number;
  /** position on the flowchart canvas */
  flowX?: number | null;
  flowY?: number | null;
}

/**
 * Flowchart canvas geometry (shared by view + auto-layout).
 *
 * PAR_Y has to land inside the first screenful: the whole point of the canvas
 * is seeing what runs alongside what, and a divider you have to scroll to find
 * hides exactly that. It leaves room for six rows of focus work above it, which
 * is more than a day's worth in practice — the canvas scrolls for the rest.
 */
export const FLOW = {
  W: 2400,
  H: 1200,
  /** y where the parallel/background swimlane begins */
  PAR_Y: 620,
  NODE_W: 192,
  NODE_H: 78,
};

export interface Goal {
  id: string;
  name: string;
  color: string;
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  tasks: Task[];
}

export interface Plan {
  goals: Goal[];
  days: Record<string, DayPlan>;
  shareToken: string;
}

/** Priority accents. Theme-aware: the actual hues live in globals.css. */
export const PRIORITY_COLOR: Record<number, string> = {
  1: "var(--prio-1)",
  2: "var(--prio-2)",
  3: "var(--prio-3)",
  4: "var(--prio-4)",
};
export const DONE_COLOR = "var(--prio-done)";

export const GOAL_COLORS = [
  "#818cf8",
  "#f59e0b",
  "#34d399",
  "#f472b6",
  "#38bdf8",
  "#a78bfa",
  "#fb923c",
  "#4ade80",
];

export function emptyDay(date: string): DayPlan {
  return { date, tasks: [] };
}
