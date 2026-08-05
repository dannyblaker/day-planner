export type Priority = 1 | 2 | 3 | 4;
export type TaskStatus = "todo" | "in-progress" | "done";

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
  /**
   * The only piece of status that is stored, because it is the only one you
   * assert: to-do and in-progress fall out of the graph. See statusOf().
   */
  done: boolean;
  /** background lane: runs concurrently with focus work (laundry, CI, waiting) */
  parallel?: boolean;
  order: number;
  createdAt: number;
  /** position on the flowchart canvas */
  flowX?: number | null;
  flowY?: number | null;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  "in-progress": "In progress",
  done: "Done",
};

/** How the app lists work: what you can do now, then what is waiting, then what is finished. */
export const STATUS_ORDER: TaskStatus[] = ["in-progress", "todo", "done"];

/**
 * Status accent — the dot in the list, the text in the editor. The node and row
 * skins are the matching `.status-*` classes; both sets of hues live in
 * globals.css so they follow the theme.
 */
export const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: "var(--status-todo)",
  "in-progress": "var(--status-progress)",
  done: "var(--status-done)",
};

/** Flowchart canvas geometry (shared by view + auto-layout). */
export const FLOW = {
  W: 2400,
  H: 1200,
  NODE_W: 192,
  NODE_H: 78,
};

export interface Goal {
  id: string;
  name: string;
  color: string;
}

/**
 * The whole plan: one flat graph of work, with no date on it.
 *
 * There used to be a day per date and a task belonged to one of them. Nothing
 * here needs a calendar — a dependency graph is a statement about order, not
 * about when — and the days mostly served the schedule that no longer exists.
 */
export interface Plan {
  goals: Goal[];
  tasks: Task[];
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

/** Goal accents, drawn from the swamp: water, reeds, sun, clay, orchid. */
export const GOAL_COLORS = [
  "#3fbfae",
  "#e0a92e",
  "#6cbf4a",
  "#e0765f",
  "#4fa8d8",
  "#b98adf",
  "#f0a05a",
  "#9dcf3f",
];

