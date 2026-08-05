import { flowDepths, urgencies } from "./graph";
import { FLOW, Task } from "./types";

export interface FlowPos {
  x: number;
  y: number;
}

/** x of the column a task at this dependency depth belongs in. */
export const columnX = (depth: number) => 40 + depth * (FLOW.NODE_W + 60);

/** y of the nth task stacked in one column. Derived, so a node can grow. */
export const rowY = (i: number) => 40 + i * (FLOW.NODE_H + 28);

/**
 * Where every task sits, as a pure function of the graph.
 *
 * Nothing stores a position any more. The board reads left to right by
 * dependency depth — what has to happen first is on the left — and top to bottom
 * by urgency, which is the priority a task inherits from whatever is waiting on
 * it (see urgencies()). So the important work is along the top, and so is
 * everything it needs, in the order it needs it: a P1 five prerequisites deep
 * drags the whole chain up with it rather than sitting above unrelated work.
 *
 * Within one band of equal urgency, a task follows its prerequisites — it lands
 * level with the average row of what it waits on, which keeps a chain running
 * straight across instead of stitching between rows. Columns are laid out left
 * to right so that pull always reads positions that are already decided.
 */
export function layoutFlow(tasks: Task[]): Map<string, FlowPos> {
  const depths = flowDepths(tasks);
  const urgency = urgencies(tasks);

  const columns = new Map<number, Task[]>();
  for (const t of tasks) {
    const depth = depths.get(t.id) ?? 0;
    const column = columns.get(depth);
    if (column) column.push(t);
    else columns.set(depth, [t]);
  }

  const out = new Map<string, FlowPos>();
  for (const depth of [...columns.keys()].sort((a, b) => a - b)) {
    const column = columns.get(depth)!;
    const pull = new Map(
      column.map((t) => {
        const ys = t.dependsOn
          .map((id) => out.get(id)?.y)
          .filter((y): y is number => y != null);
        return [t.id, ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0];
      })
    );
    column.sort(
      (a, b) =>
        urgency.get(a.id)! - urgency.get(b.id)! ||
        pull.get(a.id)! - pull.get(b.id)! ||
        a.priority - b.priority ||
        a.order - b.order
    );
    column.forEach((t, i) => out.set(t.id, { x: columnX(depth), y: rowY(i) }));
  }
  return out;
}
