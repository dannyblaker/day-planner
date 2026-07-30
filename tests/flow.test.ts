import { arrangeByDepth, columnX, inParallelBand } from "@/lib/flow";
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

  it("lays concurrent work out in the ∥ band and focus work above it", () => {
    const layout = arrangeByDepth([
      makeTask({ id: "focus" }),
      makeTask({ id: "ci", parallel: true }),
    ]);
    expect(inParallelBand(layout.get("ci")!.y)).toBe(true);
    expect(inParallelBand(layout.get("focus")!.y)).toBe(false);
  });

  it("stacks the two bands independently, so neither pushes the other down", () => {
    const layout = arrangeByDepth([
      makeTask({ id: "f1", order: 1 }),
      makeTask({ id: "f2", order: 2 }),
      makeTask({ id: "ci", order: 3, parallel: true }),
    ]);
    expect(layout.get("ci")!.y).toBe(FLOW.PAR_Y + 50);
  });

  it("terminates on a cycle rather than hanging", () => {
    const tasks = [
      makeTask({ id: "a", dependsOn: ["b"] }),
      makeTask({ id: "b", dependsOn: ["a"] }),
    ];
    expect(arrangeByDepth(tasks).size).toBe(2);
  });
});

describe("inParallelBand", () => {
  it("counts a node whose middle crosses the divider", () => {
    expect(inParallelBand(FLOW.PAR_Y - FLOW.NODE_H)).toBe(false);
    expect(inParallelBand(FLOW.PAR_Y)).toBe(true);
  });
});
