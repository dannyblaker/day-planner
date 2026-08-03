import { arrangeByDepth, columnX } from "@/lib/flow";
import { FLOW } from "@/lib/types";
import { beforeEach, describe, expect, it } from "vitest";
import { makeTask, resetFactory } from "./factory";

beforeEach(resetFactory);

describe("arrangeByDepth", () => {
  it("puts each task in the column its dependency depth earns", () => {
    const layout = arrangeByDepth([
      makeTask({ id: "a" }),
      makeTask({ id: "b", dependsOn: ["a"] }),
      makeTask({ id: "c", dependsOn: ["b"] }),
    ]);
    expect(layout.get("a")!.x).toBe(columnX(0));
    expect(layout.get("b")!.x).toBe(columnX(1));
    expect(layout.get("c")!.x).toBe(columnX(2));
  });

  it("stacks tasks that share a column instead of overlapping them", () => {
    const layout = arrangeByDepth([
      makeTask({ id: "a", order: 1 }),
      makeTask({ id: "b", order: 2 }),
    ]);
    expect(layout.get("a")!.x).toBe(layout.get("b")!.x);
    expect(Math.abs(layout.get("a")!.y - layout.get("b")!.y)).toBeGreaterThanOrEqual(
      FLOW.NODE_H
    );
  });

  it("stacks concurrent work in with the rest — one canvas, no bands", () => {
    const layout = arrangeByDepth([
      makeTask({ id: "f1", order: 1 }),
      makeTask({ id: "f2", order: 2 }),
      makeTask({ id: "ci", order: 3, parallel: true }),
    ]);
    const ys = ["f1", "f2", "ci"].map((id) => layout.get(id)!.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(ys[2] - ys[1]).toBe(ys[1] - ys[0]);
  });

  it("terminates on a cycle rather than hanging", () => {
    const tasks = [
      makeTask({ id: "a", dependsOn: ["b"] }),
      makeTask({ id: "b", dependsOn: ["a"] }),
    ];
    expect(arrangeByDepth(tasks).size).toBe(2);
  });
});
