import { columnX, layoutFlow, rowY } from "@/lib/flow";
import { FLOW } from "@/lib/types";
import { beforeEach, describe, expect, it } from "vitest";
import { makeTask, resetFactory } from "./factory";

beforeEach(resetFactory);

describe("layoutFlow", () => {
  it("puts each task in the column its dependency depth earns", () => {
    const layout = layoutFlow([
      makeTask({ id: "a" }),
      makeTask({ id: "b", dependsOn: ["a"] }),
      makeTask({ id: "c", dependsOn: ["b"] }),
    ]);
    expect(layout.get("a")!.x).toBe(columnX(0));
    expect(layout.get("b")!.x).toBe(columnX(1));
    expect(layout.get("c")!.x).toBe(columnX(2));
  });

  it("stacks tasks that share a column instead of overlapping them", () => {
    const layout = layoutFlow([
      makeTask({ id: "a", order: 1 }),
      makeTask({ id: "b", order: 2 }),
    ]);
    expect(layout.get("a")!.x).toBe(layout.get("b")!.x);
    expect(Math.abs(layout.get("a")!.y - layout.get("b")!.y)).toBeGreaterThanOrEqual(
      FLOW.NODE_H
    );
  });

  it("stacks concurrent work in with the rest — one canvas, no bands", () => {
    const layout = layoutFlow([
      makeTask({ id: "f1", order: 1 }),
      makeTask({ id: "f2", order: 2 }),
      makeTask({ id: "ci", order: 3, parallel: true }),
    ]);
    const ys = ["f1", "f2", "ci"].map((id) => layout.get(id)!.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys[2] - ys[1]).toBe(ys[1] - ys[0]);
  });

  it("sorts a column by priority, most urgent at the top", () => {
    const layout = layoutFlow([
      makeTask({ id: "meh", priority: 3, order: 1 }),
      makeTask({ id: "now", priority: 1, order: 2 }),
      makeTask({ id: "soon", priority: 2, order: 3 }),
    ]);
    expect(layout.get("now")!.y).toBe(rowY(0));
    expect(layout.get("soon")!.y).toBe(rowY(1));
    expect(layout.get("meh")!.y).toBe(rowY(2));
  });

  it("lifts what an urgent task waits on, whatever that task calls itself", () => {
    // "dull" is a P3 on its own account, but the P1 can't start without it
    const layout = layoutFlow([
      makeTask({ id: "busywork", priority: 2, order: 1 }),
      makeTask({ id: "dull", priority: 3, order: 2 }),
      makeTask({ id: "urgent", priority: 1, order: 3, dependsOn: ["dull"] }),
    ]);
    expect(layout.get("dull")!.y).toBe(rowY(0));
    expect(layout.get("busywork")!.y).toBe(rowY(1));
    // and the chain reads straight across the top
    expect(layout.get("urgent")!.y).toBe(rowY(0));
    expect(layout.get("urgent")!.x).toBeGreaterThan(layout.get("dull")!.x);
  });

  it("keeps a chain level rather than stitching between rows", () => {
    const layout = layoutFlow([
      makeTask({ id: "a1", order: 1 }),
      makeTask({ id: "a2", order: 2 }),
      // b2 is declared first, but follows the row of what it waits on
      makeTask({ id: "b2", order: 3, dependsOn: ["a2"] }),
      makeTask({ id: "b1", order: 4, dependsOn: ["a1"] }),
    ]);
    expect(layout.get("b1")!.y).toBe(layout.get("a1")!.y);
    expect(layout.get("b2")!.y).toBe(layout.get("a2")!.y);
  });

  it("terminates on a cycle rather than hanging", () => {
    const tasks = [
      makeTask({ id: "a", dependsOn: ["b"] }),
      makeTask({ id: "b", dependsOn: ["a"] }),
    ];
    expect(layoutFlow(tasks).size).toBe(2);
  });

  it("places every task, dangling dependency or not", () => {
    const layout = layoutFlow([
      makeTask({ id: "a", dependsOn: ["gone"] }),
      makeTask({ id: "b" }),
    ]);
    expect([...layout.keys()].sort()).toEqual(["a", "b"]);
  });
});
