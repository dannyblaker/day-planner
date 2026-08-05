import {
  cycleOf,
  dependentsOf,
  finishedGroups,
  flowDepths,
  statuses,
  urgencies,
} from "@/lib/graph";
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

describe("urgencies", () => {
  it("gives a task its own priority when nothing waits on it", () => {
    const u = urgencies([makeTask({ id: "a", priority: 3 })]);
    expect(u.get("a")).toBe(3);
  });

  it("hands a task the priority of the most urgent thing waiting on it", () => {
    const u = urgencies([
      makeTask({ id: "dull", priority: 3 }),
      makeTask({ id: "meh", priority: 3, dependsOn: ["dull"] }),
      makeTask({ id: "urgent", priority: 1, dependsOn: ["dull"] }),
    ]);
    expect(u.get("dull")).toBe(1);
    expect(u.get("meh")).toBe(3);
  });

  it("carries urgency the whole way down a chain", () => {
    const u = urgencies([
      makeTask({ id: "a", priority: 3 }),
      makeTask({ id: "b", priority: 3, dependsOn: ["a"] }),
      makeTask({ id: "c", priority: 2, dependsOn: ["b"] }),
    ]);
    expect(u.get("a")).toBe(2);
    expect(u.get("b")).toBe(2);
  });

  it("never lowers a task below its own priority", () => {
    const u = urgencies([
      makeTask({ id: "a", priority: 1 }),
      makeTask({ id: "b", priority: 3, dependsOn: ["a"] }),
    ]);
    expect(u.get("a")).toBe(1);
  });

  it("terminates on a cycle rather than hanging", () => {
    const u = urgencies([
      makeTask({ id: "a", priority: 2, dependsOn: ["b"] }),
      makeTask({ id: "b", priority: 3, dependsOn: ["a"] }),
    ]);
    expect(u.size).toBe(2);
  });

  it("ignores a dependent that no longer exists", () => {
    const u = urgencies([makeTask({ id: "a", priority: 3, dependsOn: ["ghost"] })]);
    expect(u.get("a")).toBe(3);
  });
});

/**
 * What auto-delete is allowed to take: work that is finished and finished with.
 * Cutting an arrow to a task that is still waiting would leave it unable to say
 * what it was waiting for, so a run of joined work goes all at once or not yet.
 */
describe("finishedGroups", () => {
  const ids = (tasks: ReturnType<typeof makeTask>[]) => [...finishedGroups(tasks)].sort();

  it("takes a done task that is joined to nothing", () => {
    expect(ids([makeTask({ id: "a", done: true })])).toEqual(["a"]);
  });

  it("leaves a task that isn't done", () => {
    expect(ids([makeTask({ id: "a" })])).toEqual([]);
  });

  it("holds a done task while something still waits on it", () => {
    expect(
      ids([
        makeTask({ id: "a", done: true }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ])
    ).toEqual([]);
  });

  it("holds a done task while what it waited on is unfinished", () => {
    expect(
      ids([
        makeTask({ id: "a" }),
        makeTask({ id: "b", done: true, dependsOn: ["a"] }),
      ])
    ).toEqual([]);
  });

  it("takes the whole chain once the last of it is done", () => {
    expect(
      ids([
        makeTask({ id: "a", done: true }),
        makeTask({ id: "b", done: true, dependsOn: ["a"] }),
        makeTask({ id: "c", done: true, dependsOn: ["b"] }),
      ])
    ).toEqual(["a", "b", "c"]);
  });

  it("holds a whole chain for one unfinished task at the far end of it", () => {
    expect(
      ids([
        makeTask({ id: "a", done: true }),
        makeTask({ id: "b", done: true, dependsOn: ["a"] }),
        makeTask({ id: "c", dependsOn: ["b"] }),
      ])
    ).toEqual([]);
  });

  it("judges each run of work on its own", () => {
    expect(
      ids([
        makeTask({ id: "done1", done: true }),
        makeTask({ id: "done2", done: true, dependsOn: ["done1"] }),
        makeTask({ id: "busy1", done: true }),
        makeTask({ id: "busy2", dependsOn: ["busy1"] }),
      ])
    ).toEqual(["done1", "done2"]);
  });

  it("counts a diamond as one run", () => {
    const diamond = [
      makeTask({ id: "top", done: true }),
      makeTask({ id: "left", done: true, dependsOn: ["top"] }),
      makeTask({ id: "right", dependsOn: ["top"] }),
      makeTask({ id: "bottom", done: true, dependsOn: ["left", "right"] }),
    ];
    expect(ids(diamond)).toEqual([]);
    diamond[2].done = true;
    expect(ids(diamond)).toEqual(["bottom", "left", "right", "top"]);
  });

  it("ignores a dependency on a task that no longer exists", () => {
    expect(ids([makeTask({ id: "a", done: true, dependsOn: ["ghost"] })])).toEqual(["a"]);
  });

  it("terminates on a cycle rather than hanging", () => {
    expect(
      ids([
        makeTask({ id: "a", done: true, dependsOn: ["b"] }),
        makeTask({ id: "b", done: true, dependsOn: ["a"] }),
      ])
    ).toEqual(["a", "b"]);
  });
});
