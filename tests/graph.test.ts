import { dependentsOf, flowDepths } from "@/lib/graph";
import { beforeEach, describe, expect, it } from "vitest";
import { makeTask, resetFactory } from "./factory";

beforeEach(resetFactory);

describe("flowDepths", () => {
  it("counts prerequisites, not hops in the array", () => {
    const tasks = [
      makeTask({ id: "a" }),
      makeTask({ id: "b", dependsOn: ["a"] }),
      makeTask({ id: "c", dependsOn: ["b"] }),
      makeTask({ id: "d", dependsOn: ["a"] }),
    ];
    const depths = flowDepths(tasks);
    expect([depths.get("a"), depths.get("b"), depths.get("c"), depths.get("d")]).toEqual([
      0, 1, 2, 1,
    ]);
  });

  it("takes the longest path to a task with several prerequisites", () => {
    const tasks = [
      makeTask({ id: "a" }),
      makeTask({ id: "b", dependsOn: ["a"] }),
      makeTask({ id: "c", dependsOn: ["a", "b"] }),
    ];
    expect(flowDepths(tasks).get("c")).toBe(2);
  });

  it("ignores a dependency on a task that no longer exists", () => {
    expect(flowDepths([makeTask({ id: "b", dependsOn: ["ghost"] })]).get("b")).toBe(0);
  });

  it("terminates on a cycle", () => {
    const tasks = [
      makeTask({ id: "a", dependsOn: ["b"] }),
      makeTask({ id: "b", dependsOn: ["a"] }),
    ];
    expect(() => flowDepths(tasks)).not.toThrow();
  });
});

describe("dependentsOf", () => {
  it("finds transitive dependents", () => {
    const tasks = [
      makeTask({ id: "a" }),
      makeTask({ id: "b", dependsOn: ["a"] }),
      makeTask({ id: "c", dependsOn: ["b"] }),
      makeTask({ id: "unrelated" }),
    ];
    expect([...dependentsOf(tasks, "a")].sort()).toEqual(["b", "c"]);
  });

  it("returns nothing for a task nobody depends on", () => {
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    expect(dependentsOf(tasks, "a").size).toBe(0);
  });
});
