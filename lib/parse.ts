import { Goal, Priority, Task } from "./types";

export interface ParsedTask {
  title: string;
  duration: number;
  priority: Priority;
  goalName?: string;
  dependsOn: string[];
  parallel: boolean;
  blocked: string | null;
  /** insert at front of the queue (do next) */
  urgent: boolean;
}

/**
 * Quick-add syntax, e.g.:
 *   "Write report 45m !1 #deepwork >design ~ ^"
 *   45m/1h    duration                !1..!4   priority
 *   #goal     goal (created if new)   >title   depends on title prefix
 *   ~         background/parallel     *reason  blocked
 *   ^         do next (front of queue)
 */
export function parseQuickAdd(
  input: string,
  dayTasks: Task[],
  goals: Goal[]
): ParsedTask {
  const out: ParsedTask = {
    title: "",
    duration: 30,
    priority: 3,
    dependsOn: [],
    parallel: false,
    blocked: null,
    urgent: false,
  };
  const words: string[] = [];

  for (const raw of input.trim().split(/\s+/)) {
    if (!raw) continue;
    let m = raw.match(/^(\d+(?:\.\d+)?)(m|min|h|hr)$/i);
    if (m) {
      const n = parseFloat(m[1]);
      out.duration = Math.max(
        5,
        Math.round(/^h/i.test(m[2]) ? n * 60 : n)
      );
      continue;
    }
    m = raw.match(/^(\d+)h(\d+)m?$/i); // 1h30
    if (m) {
      out.duration = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      continue;
    }
    m = raw.match(/^!([1-4])$/);
    if (m) {
      out.priority = parseInt(m[1], 10) as Priority;
      continue;
    }
    if (raw.startsWith("#") && raw.length > 1) {
      const name = raw.slice(1);
      const existing = goals.find(
        (g) => g.name.toLowerCase() === name.toLowerCase()
      );
      out.goalName = existing ? existing.name : name;
      continue;
    }
    if (raw.startsWith(">") && raw.length > 1) {
      const q = raw.slice(1).toLowerCase();
      const dep = dayTasks.find((t) =>
        t.title.toLowerCase().startsWith(q)
      );
      if (dep) {
        out.dependsOn.push(dep.id);
        continue;
      }
    }
    if (raw === "~") {
      out.parallel = true;
      continue;
    }
    if (raw.startsWith("*")) {
      out.blocked = raw.slice(1).replace(/-/g, " ") || "Blocked";
      continue;
    }
    if (raw === "^") {
      out.urgent = true;
      continue;
    }
    words.push(raw);
  }

  out.title = words.join(" ");
  return out;
}
