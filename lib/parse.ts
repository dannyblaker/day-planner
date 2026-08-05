import { Goal, Priority, Task } from "./types";

export interface ParsedTask {
  title: string;
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
 *   "Write report !1 #deepwork >design ~ ^"
 *   !1..!4    priority               #goal    goal (created if new)
 *   >title    depends on title prefix
 *   ~         background/parallel    *reason  blocked
 *   ^         do next (front of queue)
 *
 * Anything that isn't a token is title. There used to be a duration token here
 * (`45m`, `1h30`); a plan with no clock in it had no use for the number, so
 * `45m` is now four characters of a title like any other.
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
    parallel: false,
    blocked: null,
    urgent: false,
  };
  const words: string[] = [];

  for (const raw of input.trim().split(/\s+/)) {
    if (!raw) continue;
    const m = raw.match(/^!([1-4])$/);
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
