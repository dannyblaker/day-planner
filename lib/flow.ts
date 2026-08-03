import { flowDepths } from "./graph";
import { Task } from "./types";

export interface FlowPos {
  x: number;
  y: number;
}

/** x of the column a task at this dependency depth belongs in. */
export const columnX = (depth: number) => 40 + depth * 250;

/**
 * Lay the whole graph out left-to-right by dependency depth, stacking each
 * column top to bottom.
 *
 * Pure, so it serves two jobs: the auto-arrange action, and the fallback
 * position for a node the canvas is asked to draw before anything has assigned
 * it one (the read-only share view, which cannot write back).
 */
export function arrangeByDepth(tasks: Task[]): Map<string, FlowPos> {
  const depths = flowDepths(tasks);
  const counters: Record<string, number> = {};
  const out = new Map<string, FlowPos>();
  const sorted = [...tasks].sort(
    (a, b) => (depths.get(a.id) || 0) - (depths.get(b.id) || 0) || a.order - b.order
  );
  for (const t of sorted) {
    const depth = depths.get(t.id) || 0;
    const i = (counters[depth] = (counters[depth] ?? -1) + 1);
    out.set(t.id, { x: columnX(depth), y: 60 + i * 100 });
  }
  return out;
}
