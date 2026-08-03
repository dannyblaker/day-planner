import { cycleOf, dependentsOf, flowDepths, statuses } from "@/lib/graph";
import { beforeEach, describe, expect, it } from "vitest";
import { makeTask, resetFactory } from "./factory";

beforeEach(resetFactory);

describe("statuses", () => {
  const of = (tasks: ReturnType<typeof makeTask>[]) => {
    const m = statuses(tasks);
    return Object.fromEntries(tasks.map((t) => [t.id, m.get(t.id)]));
  };

  it("calls a task with no prerequisites in progress", () => {
    expect(of([makeTask({ id: "a" })])).toEqual({ a: "in-progress" });
  });

  it("holds a task with an unfinished prerequisite at to do", () => {
    expect(
      of([makeTask({ id: "a" }), makeTask({ id: "b", dependsOn: ["a"] })])
    ).toEqual({ a: "in-progress", b: "todo" });
  });

  it("promotes the dependent once the prerequisite is done", () => {
    expect(
      of([
        makeTask({ id: "a", done: true }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ])
    ).toEqual({ a: "done", b: "in-progress" });
  });

  it("promotes only the next link, not the whole chain", () => {
    expect(
      of([
        makeTask({ id: "a", done: true }),
        makeTask({ id: "b", dependsOn: ["a"] }),
        makeTask({ id: "c", dependsOn: ["b"] }),
      ])
    ).toEqual({ a: "done", b: "in-progress", c: "todo" });
  });

  it("waits for every prerequisite, not just one", () => {
    expect(
      of([
        makeTask({ id: "a", done: true }),
        makeTask({ id: "b" }),
        makeTask({ id: "c", dependsOn: ["a", "b"] }),
      ])
    ).toEqual({ a: "done", b: "in-progress", c: "todo" });
  });

  it("puts the whole leftmost column in progress at once — that is the point", () => {
    expect(
      of([makeTask({ id: "a" }), makeTask({ id: "b" }), makeTask({ id: "c" })])
    ).toEqual({ a: "in-progress", b: "in-progress", c: "in-progress" });
  });

  it("holds a blocked task at to do however clear its prerequisites are", () => {
    expect(of([makeTask({ id: "a", blocked: "waiting on legal" })])).toEqual({
      a: "todo",
    });
  });

  it("reports a finished task as done even if it is also blocked", () => {
    expect(of([makeTask({ id: "a", done: true, blocked: "stale" })])).toEqual({
      a: "done",
    });
  });

  it("does not strand a task behind a dependency that no longer exists", () => {
    expect(of([makeTask({ id: "b", dependsOn: ["ghost"] })])).toEqual({
      b: "in-progress",
    });
  });

  it("leaves both sides of a cycle waiting rather than hanging", () => {
    expect(
      of([
        makeTask({ id: "a", dependsOn: ["b"] }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ])
    ).toEqual({ a: "todo", b: "todo" });
  });
});

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

describe("cycleOf", () => {
  it("says nothing about a graph that is fine", () => {
    const tasks = [
      makeTask({ id: "a" }),
      makeTask({ id: "b", dependsOn: ["a"] }),
      makeTask({ id: "c", dependsOn: ["a", "b"] }),
    ];
    expect(cycleOf(tasks)).toBeNull();
  });

  it("returns the loop, as a path that ends where it starts", () => {
    const tasks = [
      makeTask({ id: "a", dependsOn: ["c"] }),
      makeTask({ id: "b", dependsOn: ["a"] }),
      makeTask({ id: "c", dependsOn: ["b"] }),
    ];
    const cycle = cycleOf(tasks)!;
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
    expect(new Set(cycle)).toEqual(new Set(["a", "b", "c"]));
  });

  it("catches a task that depends on itself", () => {
    expect(cycleOf([makeTask({ id: "a", dependsOn: ["a"] })])).toEqual(["a", "a"]);
  });

  it("does not mistake a diamond for a loop", () => {
    const tasks = [
      makeTask({ id: "a" }),
      makeTask({ id: "b", dependsOn: ["a"] }),
      makeTask({ id: "c", dependsOn: ["a"] }),
      makeTask({ id: "d", dependsOn: ["b", "c"] }),
    ];
    expect(cycleOf(tasks)).toBeNull();
  });

  it("ignores a dependency on a task that no longer exists", () => {
    expect(cycleOf([makeTask({ id: "a", dependsOn: ["ghost"] })])).toBeNull();
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
