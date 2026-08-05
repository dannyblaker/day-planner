import { columnX } from "@/lib/flow";
import { useApp } from "@/lib/store";
import { FLOW, Plan, Task } from "@/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore } from "./app-state";
import { makePlan, makeTask, resetFactory } from "./factory";

const app = () => useApp.getState();
const tasks = () => app().plan.tasks;
const task = (id: string) => tasks().find((t) => t.id === id);
const titles = () => tasks().map((t) => t.title);
/** queue order, which is what the `order` field encodes */
const queue = () =>
  [...tasks()].sort((a, b) => a.order - b.order).map((t) => t.id);

function load(seed: Task[] = []) {
  app().load(makePlan(seed));
}

beforeEach(() => {
  resetFactory();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 28, 9, 0, 0));
  resetStore();
});

describe("quickAdd", () => {
  beforeEach(() => load());

  it("adds a parsed task to the end of the queue and selects it", () => {
    const id = app().quickAdd("Write report 45m !1");
    expect(id).toBeTruthy();
    expect(task(id!)).toMatchObject({
      title: "Write report",
      duration: 45,
      priority: 1,
      done: false,
    });
    expect(app().selectedId).toBe(id);
  });

  it("refuses an input with no title", () => {
    expect(app().quickAdd("45m !1")).toBeNull();
    expect(tasks()).toHaveLength(0);
  });

  it("puts a ^urgent task at the front of the queue", () => {
    const first = app().quickAdd("First")!;
    const urgent = app().quickAdd("Hotfix ^")!;
    expect(queue()).toEqual([urgent, first]);
  });

  it("reuses an existing goal rather than duplicating it", () => {
    const id = app().quickAdd("Task #deep-work")!;
    expect(app().plan.goals).toHaveLength(1);
    expect(task(id)!.goalId).toBe("g1");
  });

  it("creates an unknown goal, cycling through the palette", () => {
    const id = app().quickAdd("Task #reading")!;
    const goal = app().plan.goals.find((g) => g.name === "reading");
    expect(goal).toBeDefined();
    expect(task(id)!.goalId).toBe(goal!.id);
  });

  it("carries dependencies, parallel and blocked through from the parser", () => {
    const base = app().quickAdd("Design the thing")!;
    const id = app().quickAdd("Build it >design ~ *waiting-on-review")!;
    expect(task(id)).toMatchObject({
      dependsOn: [base],
      parallel: true,
      blocked: "waiting on review",
    });
  });

  it("adds to an empty board", () => {
    app().load(makePlan([]));
    expect(app().quickAdd("First ever task")).toBeTruthy();
    expect(tasks()).toHaveLength(1);
  });
});

describe("editing a task", () => {
  beforeEach(() => load([makeTask({ id: "a", title: "Alpha" })]));

  it("patches only the given fields", () => {
    app().updateTask("a", { title: "Renamed", duration: 90 });
    expect(task("a")).toMatchObject({ title: "Renamed", duration: 90, priority: 3 });
  });

  it("ignores an unknown id", () => {
    expect(() => app().updateTask("ghost", { title: "x" })).not.toThrow();
    expect(titles()).toEqual(["Alpha"]);
  });

  it("sets priority and clamps duration at 5 minutes", () => {
    app().setPriority("a", 1);
    app().adjustDuration("a", -15);
    app().adjustDuration("a", -15);
    expect(task("a")).toMatchObject({ priority: 1, duration: 5 });
  });

  it("adjusts duration upward in steps", () => {
    app().adjustDuration("a", 15);
    expect(task("a")!.duration).toBe(45);
  });
});

describe("deleting", () => {
  beforeEach(() =>
    load(
      [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ]
    )
  );

  it("removes the task and any dependency pointing at it", () => {
    app().deleteTask("a");
    expect(titles()).toHaveLength(1);
    expect(task("b")!.dependsOn).toEqual([]);
  });

  it("clears the selection and closes the editor when the selected task goes", () => {
    app().select("a");
    app().setEditorOpen(true);
    app().deleteTask("a");
    expect(app().selectedId).toBeNull();
    expect(app().editorOpen).toBe(false);
  });

  it("leaves an unrelated selection alone", () => {
    app().select("b");
    app().deleteTask("a");
    expect(app().selectedId).toBe("b");
  });
});

describe("queue order", () => {
  beforeEach(() =>
    load(
      [
        makeTask({ id: "a", order: 1 }),
        makeTask({ id: "b", order: 2 }),
        makeTask({ id: "c", order: 3 }),
      ]
    )
  );

  it("moves a task down and up", () => {
    app().moveTask("b", 1);
    expect(queue()).toEqual(["a", "c", "b"]);
    app().moveTask("b", -1);
    expect(queue()).toEqual(["a", "b", "c"]);
  });

  it("does nothing at the ends of the queue", () => {
    app().moveTask("a", -1);
    app().moveTask("c", 1);
    expect(queue()).toEqual(["a", "b", "c"]);
  });

  it("swaps with the next queued task, stepping over finished ones", () => {
    app().updateTask("b", { done: true });
    app().moveTask("a", 1); // a trades places with c, not with the done b
    expect(queue()).toEqual(["c", "b", "a"]);
  });

  it("re-inserts a dragged task before another", () => {
    app().placeBefore("c", "a");
    expect(queue()).toEqual(["c", "a", "b"]);
  });

  it("moves a dragged task to the end when dropped past the last row", () => {
    app().placeBefore("a", null);
    expect(queue()).toEqual(["b", "c", "a"]);
  });

  it("ignores a drop onto itself", () => {
    app().placeBefore("b", "b");
    expect(queue()).toEqual(["a", "b", "c"]);
  });

  it("sorts by priority, keeping queue order as the tie-break", () => {
    app().setPriority("c", 1);
    app().setPriority("a", 2);
    app().autoSort();
    expect(queue()).toEqual(["c", "a", "b"]);
  });

  it("leaves done tasks out of an auto-sort", () => {
    app().updateTask("a", { done: true });
    app().setPriority("c", 1);
    app().autoSort();
    expect(queue().slice(0, 2)).toEqual(["a", "c"]);
  });
});

describe("toggleDone", () => {
  beforeEach(() => load([makeTask({ id: "a" })]));

  it("completes a queued task and reopens a finished one", () => {
    app().toggleDone("a");
    expect(task("a")!.done).toBe(true);
    app().toggleDone("a");
    expect(task("a")!.done).toBe(false);
  });

  it("sets done outright, for the editor's button", () => {
    app().setDone("a", true);
    expect(task("a")!.done).toBe(true);
    app().setDone("a", true); // idempotent
    expect(task("a")!.done).toBe(true);
    app().setDone("a", false);
    expect(task("a")!.done).toBe(false);
  });

  it("ignores an unknown id", () => {
    expect(() => app().toggleDone("ghost")).not.toThrow();
  });
});

describe("blocking", () => {
  beforeEach(() => load([makeTask({ id: "a" })]));

  it("blocks with a reason and unblocks on the second call", () => {
    app().toggleBlocked("a", "waiting on legal");
    expect(task("a")!.blocked).toBe("waiting on legal");
    app().toggleBlocked("a");
    expect(task("a")!.blocked).toBeNull();
  });

  it("defaults the reason", () => {
    app().toggleBlocked("a");
    expect(task("a")!.blocked).toBe("Blocked");
  });

  it("leaves the done flag alone — blocked and finished are separate facts", () => {
    app().setDone("a", true);
    app().toggleBlocked("a", "stuck");
    expect(task("a")).toMatchObject({ done: true, blocked: "stuck" });
  });
});

describe("dependencies", () => {
  beforeEach(() =>
    load([makeTask({ id: "a" }), makeTask({ id: "b" }), makeTask({ id: "c" })])
  );

  it("adds and removes a link", () => {
    app().toggleDependency("b", "a");
    expect(task("b")!.dependsOn).toEqual(["a"]);
    app().toggleDependency("b", "a");
    expect(task("b")!.dependsOn).toEqual([]);
  });

  it("refuses to make a task depend on itself", () => {
    app().toggleDependency("a", "a");
    expect(task("a")!.dependsOn).toEqual([]);
  });

  it("refuses a link that would close a cycle", () => {
    app().toggleDependency("b", "a"); // b after a
    app().toggleDependency("c", "b"); // c after b
    app().toggleDependency("a", "c"); // would make a wait on its own dependent
    expect(task("a")!.dependsOn).toEqual([]);
  });
});

describe("goals", () => {
  beforeEach(() => load([makeTask({ id: "a", goalId: "g1" })]));

  it("adds a goal, trimming the name", () => {
    app().addGoal("  reading  ");
    expect(app().plan.goals.map((g) => g.name)).toEqual(["deep-work", "reading"]);
  });

  it("ignores blank and duplicate names", () => {
    app().addGoal("   ");
    app().addGoal("DEEP-WORK");
    expect(app().plan.goals).toHaveLength(1);
  });

  it("unassigns the goal from every task when deleted", () => {
    const other = app().quickAdd("Another task #deep-work")!;
    app().deleteGoal("g1");
    expect(task("a")!.goalId).toBeNull();
    expect(task(other)!.goalId).toBeNull();
  });
});

describe("clearing finished work", () => {
  beforeEach(() =>
    load(
      [
        makeTask({ id: "done1", title: "Done one", done: true }),
        makeTask({ id: "done2", title: "Done two", done: true }),
        makeTask({ id: "todo", title: "Still to do", dependsOn: ["done1"] }),
      ]
    )
  );

  it("removes the finished tasks and the links pointing at them", () => {
    app().clearDone();
    expect(titles()).toEqual(["Still to do"]);
    expect(task("todo")!.dependsOn).toEqual([]);
  });

  it("records the batch so it can be undone", () => {
    app().clearDone();
    expect(app().lastCleared).toMatchObject({ deps: { todo: ["done1"] } });
    expect(app().lastCleared!.tasks.map((t) => t.id)).toEqual(["done1", "done2"]);
  });

  it("does nothing, and offers no undo, when nothing is finished", () => {
    app().clearDone();
    app().dismissUndo();
    app().clearDone();
    expect(app().lastCleared).toBeNull();
  });

  it("deselects a cleared task", () => {
    app().select("done1");
    app().setEditorOpen(true);
    app().clearDone();
    expect(app().selectedId).toBeNull();
    expect(app().editorOpen).toBe(false);
  });

  it("restores the tasks and their dependency links on undo", () => {
    app().clearDone();
    app().undoClear();
    expect(titles().sort()).toEqual(["Done one", "Done two", "Still to do"]);
    expect(task("todo")!.dependsOn).toEqual(["done1"]);
    expect(app().lastCleared).toBeNull();
  });

  it("keeps edits made while the undo bar was up", () => {
    app().clearDone();
    const added = app().quickAdd("Typed during the undo window")!;
    app().undoClear();
    expect(titles()).toContain("Typed during the undo window");
    expect(task(added)).toBeDefined();
    expect(titles()).toHaveLength(4);
  });

  it("does not duplicate a task that came back some other way", () => {
    app().clearDone();
    app().undoClear();
    app().undoClear();
    expect(titles()).toHaveLength(3);
  });

  it("drops the offer when dismissed", () => {
    app().clearDone();
    app().dismissUndo();
    expect(app().lastCleared).toBeNull();
    app().undoClear();
    expect(titles()).toEqual(["Still to do"]);
  });

});

describe("flowchart layout", () => {
  it("gives every task a position, keeping dependents to the right", () => {
    load(
      [
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ]
    );
    app().ensureFlowPositions();
    expect(task("a")!.flowX).toBe(40);
    expect(task("b")!.flowX!).toBeGreaterThan(task("a")!.flowX!);
    expect(tasks().every((t) => t.flowY != null)).toBe(true);
  });

  it("leaves positions that already exist alone", () => {
    load([makeTask({ id: "a", flowX: 999, flowY: 111 })]);
    app().ensureFlowPositions();
    expect(task("a")).toMatchObject({ flowX: 999, flowY: 111 });
  });

  it("places parallel tasks on the same canvas as everything else", () => {
    load([makeTask({ id: "focus" }), makeTask({ id: "ci", parallel: true })]);
    app().ensureFlowPositions();
    expect(task("ci")!.flowY!).toBeLessThanOrEqual(FLOW.H - FLOW.NODE_H);
  });

  it("re-lays the whole graph by depth on auto-arrange", () => {
    load(
      [
        makeTask({ id: "a", flowX: 999, flowY: 999 }),
        makeTask({ id: "b", dependsOn: ["a"], flowX: 0, flowY: 0 }),
        makeTask({ id: "c", dependsOn: ["b"] }),
      ]
    );
    app().autoArrangeFlow();
    expect(task("a")!.flowX).toBe(columnX(0));
    expect(task("b")!.flowX).toBe(columnX(1));
    expect(task("c")!.flowX).toBe(columnX(2));
  });

  it("stacks tasks at the same depth without overlapping", () => {
    load([makeTask({ id: "a" }), makeTask({ id: "b" })]);
    app().autoArrangeFlow();
    expect(task("a")!.flowX).toBe(task("b")!.flowX);
    expect(task("a")!.flowY).not.toBe(task("b")!.flowY);
  });
});

describe("loading", () => {
  it("takes a plan from the server and marks itself ready", () => {
    app().load(makePlan([makeTask({ title: "From the server" })]));
    expect(app().loaded).toBe(true);
    expect(app().plan.tasks[0].title).toBe("From the server");
  });

  it("keeps the seeded plan on a first run with no saved data", () => {
    const seeded = app().plan;
    app().load(null);
    expect(app().loaded).toBe(true);
    expect(app().plan).toBe(seeded);
  });

  it("keeps the seed rather than a stored plan of the wrong shape", () => {
    const seeded = app().plan;
    // e.g. the pre-flattening document, which had a days map instead of tasks
    app().load({ goals: [], days: {} } as unknown as Plan);
    expect(app().plan).toBe(seeded);
    expect(app().loaded).toBe(true);
  });
});
