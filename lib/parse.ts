import { Goal, Priority, Task } from "./types";

export interface ParsedTask {
  title: string;
  priority: Priority;
  goalName?: string;
  dependsOn: string[];
  blocked: string | null;
  /** insert at front of the queue (do next) */
  urgent: boolean;
}

/**
 * Quick-add syntax, e.g.:
 *   "Write report !1 #deepwork >design ~ ^"
 *   !1..!3    priority               #goal    goal (created if new)
 *   >title    depends on title prefix
 *   *reason   blocked
 *   ^         do next (front of queue)
 *
 * Anything that isn't a token is title, and the retired tokens are the proof:
 * there used to be a duration here (`45m`, `1h30`) and a `~` that marked a task
 * as the concurrent one. A plan with no clock in it had no use for the number,
 * and a board whose whole claim is that the startable column runs at once had no
 * use for a flag saying which task that applied to. Both are ordinary words now.
 */
export function parseQuickAdd(
  input: string,
  dayTasks: Task[],
  goals: Goal[]
): ParsedTask {
  const out: ParsedTask = {
    title: "",
    priority: 3,
    dependsOn: [],
    blocked: null,
    urgent: false,
  };
  const words: string[] = [];

  for (const raw of input.trim().split(/\s+/)) {
    if (!raw) continue;
    const m = raw.match(/^!([1-3])$/);
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
