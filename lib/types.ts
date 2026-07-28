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
  /** minutes since midnight — anchors the task (meetings, appointments) */
  fixedStart?: number | null;
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

/** Flowchart canvas geometry (shared by view + auto-layout). */
export const FLOW = {
  W: 2400,
  H: 1500,
  /** y where the parallel/background swimlane begins */
  PAR_Y: 1060,
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
  dayStart: number; // minutes since midnight
  dayEnd: number;
  tasks: Task[];
}

export interface Plan {
  goals: Goal[];
  days: Record<string, DayPlan>;
  shareToken: string;
}

export interface Slot {
  task: Task;
  start: number;
  end: number;
  lane: "focus" | "background";
  fixed: boolean;
  /** ends after the day's end */
  overflow: boolean;
  /** dep ids that are blocked/unschedulable — task shown but flagged */
  waitingOn: string[];
}

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
  return { date, dayStart: 8 * 60, dayEnd: 18 * 60, tasks: [] };
}
