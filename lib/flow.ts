import { flowDepths } from "./graph";
import { FLOW, Task } from "./types";

export interface FlowPos {
  x: number;
  y: number;
}

/** x of the column a task at this dependency depth belongs in. */
export const columnX = (depth: number) => 40 + depth * 250;

/** true if a node dropped at this y landed in the ∥ swimlane */
export const inParallelBand = (y: number) => y + FLOW.NODE_H / 2 >= FLOW.PAR_Y;

/**
 * Lay the whole graph out left-to-right by dependency depth, stacking each
 * column within its band (focus above the ∥ divider, concurrent below).
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
    const i = (counters[(t.parallel ? "p" : "f") + depth] =
      (counters[(t.parallel ? "p" : "f") + depth] ?? -1) + 1);
    out.set(t.id, {
      x: columnX(depth),
      y: t.parallel ? FLOW.PAR_Y + 50 + i * 100 : 60 + i * 100,
    });
  }
  return out;
}
