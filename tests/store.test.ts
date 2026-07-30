import { useApp } from "@/lib/store";
import { FLOW } from "@/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetStore } from "./app-state";
import { at, makeDay, makePlan, makeTask, resetFactory } from "./factory";

const TODAY = "2026-07-28";
const TOMORROW = "2026-07-29";

const app = () => useApp.getState();
const tasks = () => app().plan.days[app().date].tasks;
const task = (id: string) => tasks().find((t) => t.id === id);
const titles = () => tasks().map((t) => t.title);
/** queue order, which is what the `order` field encodes */
const queue = () =>
  [...tasks()].sort((a, b) => a.order - b.order).map((t) => t.id);

function load(day = makeDay()) {
  app().load(makePlan([day]));
  app().setDate(day.date);
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
      status: "todo",
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

  it("creates the day on demand when adding to an empty date", () => {
    app().setDate("2026-08-15");
    expect(app().quickAdd("Fresh day task")).toBeTruthy();
    expect(app().plan.days["2026-08-15"].tasks).toHaveLength(1);
  });
});

describe("editing a task", () => {
  beforeEach(() => load(makeDay([makeTask({ id: "a", title: "Alpha" })])));

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
      makeDay([
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ])
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
      makeDay([
        makeTask({ id: "a", order: 1 }),
        makeTask({ id: "b", order: 2 }),
        makeTask({ id: "c", order: 3 }),
      ])
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
    app().updateTask("b", { status: "done" });
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
    app().updateTask("a", { status: "done" });
    app().setPriority("c", 1);
    app().autoSort();
    expect(queue().slice(0, 2)).toEqual(["a", "c"]);
  });
});

describe("timers", () => {
  beforeEach(() => load(makeDay([makeTask({ id: "a" }), makeTask({ id: "b" })])));

  it("starts a task at the current minute", () => {
    app().startTask("a");
    expect(task("a")).toMatchObject({ status: "active", actualStart: at(9) });
  });

  it("only ever runs one task at a time", () => {
    app().startTask("a");
    vi.setSystemTime(new Date(2026, 6, 28, 9, 20, 0));
    app().startTask("b");
    expect(task("a")).toMatchObject({ status: "todo", actualStart: null });
    expect(task("a")!.actualMinutes).toBeCloseTo(20, 5);
    expect(task("b")!.status).toBe("active");
  });

  it("banks elapsed time on pause and resumes from there", () => {
    app().startTask("a");
    vi.setSystemTime(new Date(2026, 6, 28, 9, 30, 0));
    app().pauseTask("a");
    expect(task("a")).toMatchObject({ status: "todo", actualStart: null });
    expect(task("a")!.actualMinutes).toBeCloseTo(30, 5);

    app().startTask("a");
    vi.setSystemTime(new Date(2026, 6, 28, 9, 45, 0));
    app().pauseTask("a");
    expect(task("a")!.actualMinutes).toBeCloseTo(45, 5);
  });

  it("ignores a pause on a task that isn't running", () => {
    app().pauseTask("a");
    expect(task("a")).toMatchObject({ status: "todo", actualMinutes: 0 });
  });

  it("starting a task clears its blocker", () => {
    app().toggleBlocked("a", "waiting");
    app().startTask("a");
    expect(task("a")!.blocked).toBeNull();
  });

  it("banks time when completing a running task", () => {
    app().startTask("a");
    vi.setSystemTime(new Date(2026, 6, 28, 9, 10, 0));
    app().completeTask("a");
    expect(task("a")!.status).toBe("done");
    expect(task("a")!.actualMinutes).toBeCloseTo(10, 5);
  });
});

describe("toggleDone", () => {
  beforeEach(() => load(makeDay([makeTask({ id: "a" })])));

  it("completes a queued task and reopens a finished one", () => {
    app().toggleDone("a");
    expect(task("a")!.status).toBe("done");
    app().toggleDone("a");
    expect(task("a")).toMatchObject({ status: "todo", actualStart: null });
  });

  it("stops the timer when completing the active task", () => {
    app().startTask("a");
    vi.setSystemTime(new Date(2026, 6, 28, 9, 15, 0));
    app().toggleDone("a");
    expect(task("a")!.status).toBe("done");
    expect(task("a")!.actualMinutes).toBeCloseTo(15, 5);
  });

  it("ignores an unknown id", () => {
    expect(() => app().toggleDone("ghost")).not.toThrow();
  });
});

describe("blocking", () => {
  beforeEach(() => load(makeDay([makeTask({ id: "a" })])));

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

  it("banks time and stops the timer when blocking the active task", () => {
    app().startTask("a");
    vi.setSystemTime(new Date(2026, 6, 28, 9, 5, 0));
    app().toggleBlocked("a", "stuck");
    expect(task("a")).toMatchObject({ status: "todo", actualStart: null });
    expect(task("a")!.actualMinutes).toBeCloseTo(5, 5);
  });
});

describe("dependencies", () => {
  beforeEach(() =>
    load(makeDay([makeTask({ id: "a" }), makeTask({ id: "b" }), makeTask({ id: "c" })]))
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

describe("moving between days", () => {
  beforeEach(() =>
    load(
      makeDay([
        makeTask({ id: "a", title: "Alpha", status: "done", fixedStart: at(10) }),
        makeTask({ id: "b", title: "Beta", dependsOn: ["a"] }),
      ])
    )
  );

  it("steps forward and back, and jumps to a date", () => {
    app().shiftDate(1);
    expect(app().date).toBe(TOMORROW);
    app().shiftDate(-1);
    expect(app().date).toBe(TODAY);
    app().setDate("2026-12-25");
    expect(app().date).toBe("2026-12-25");
  });

  it("drops the selection when changing day", () => {
    app().select("a");
    app().setEditorOpen(true);
    app().shiftDate(1);
    expect(app().selectedId).toBeNull();
    expect(app().editorOpen).toBe(false);
  });

  it("creates an empty day with sensible bounds on arrival", () => {
    app().shiftDate(1);
    expect(app().plan.days[TOMORROW]).toMatchObject({
      date: TOMORROW,
      dayStart: at(8),
      dayEnd: at(18),
      tasks: [],
    });
  });

  it("defers a task to tomorrow, resetting its state", () => {
    app().deferToNextDay("a");
    expect(titles()).toEqual(["Beta"]);
    const moved = app().plan.days[TOMORROW].tasks[0];
    expect(moved).toMatchObject({
      title: "Alpha",
      status: "todo",
      actualStart: null,
      fixedStart: null,
      dependsOn: [],
    });
  });

  it("cleans up dependencies left behind by a deferred task", () => {
    app().deferToNextDay("a");
    expect(task("b")!.dependsOn).toEqual([]);
  });

  it("appends the deferred task after tomorrow's existing work", () => {
    app().shiftDate(1);
    app().quickAdd("Already there");
    app().shiftDate(-1);
    app().deferToNextDay("a");
    const tomorrow = app().plan.days[TOMORROW].tasks;
    expect(tomorrow.map((t) => t.title)).toEqual(["Already there", "Alpha"]);
    expect(tomorrow[1].order).toBeGreaterThan(tomorrow[0].order);
  });
});

describe("moving a task to another day", () => {
  const LATER = "2026-08-05";
  const moved = () => app().plan.days[LATER]?.tasks ?? [];

  beforeEach(() =>
    load(
      makeDay([
        makeTask({ id: "a", title: "Alpha", status: "done", fixedStart: at(10) }),
        makeTask({ id: "b", title: "Beta", dependsOn: ["a"] }),
      ])
    )
  );

  it("takes the task off this day and puts it on that one, as it is", () => {
    app().moveTaskToDate("a", LATER);
    expect(titles()).toEqual(["Beta"]);
    expect(moved()[0]).toMatchObject({
      title: "Alpha",
      status: "done",
      fixedStart: at(10),
      dependsOn: [],
    });
  });

  it("creates the target day if it has never been visited", () => {
    app().moveTaskToDate("a", LATER);
    expect(app().plan.days[LATER]).toMatchObject({
      date: LATER,
      dayStart: at(8),
      dayEnd: at(18),
    });
  });

  it("appends it after whatever that day already holds", () => {
    app().setDate(LATER);
    app().quickAdd("Already there");
    app().setDate(TODAY);
    app().moveTaskToDate("a", LATER);
    expect(moved().map((t) => t.title)).toEqual(["Already there", "Alpha"]);
    expect(moved()[1].order).toBeGreaterThan(moved()[0].order);
  });

  it("frees the tasks left waiting on it", () => {
    app().moveTaskToDate("a", LATER);
    expect(task("b")!.dependsOn).toEqual([]);
  });

  it("stops the clock on a task moved mid-run", () => {
    app().startTask("b");
    vi.setSystemTime(new Date(2026, 6, 28, 9, 30, 0));
    app().moveTaskToDate("b", LATER);
    expect(moved()[0]).toMatchObject({
      status: "todo",
      actualStart: null,
      actualMinutes: 30,
    });
  });

  it("lets the flowchart place it afresh on its new day", () => {
    app().updateTask("a", { flowX: 100, flowY: 200 });
    app().moveTaskToDate("a", LATER);
    expect(moved()[0]).toMatchObject({ flowX: null, flowY: null });
  });

  it("closes the editor on a task that has just left the day", () => {
    app().select("a");
    app().setEditorOpen(true);
    app().moveTaskToDate("a", LATER);
    expect(app().selectedId).toBeNull();
    expect(app().editorOpen).toBe(false);
  });

  it("ignores a move to the day it is already on, or to a non-date", () => {
    app().moveTaskToDate("a", TODAY);
    app().moveTaskToDate("a", "");
    app().moveTaskToDate("a", "next friday");
    expect(titles()).toEqual(["Alpha", "Beta"]);
    expect(app().lastMoved).toBeNull();
  });

  it("ignores a task that isn't on this day", () => {
    app().moveTaskToDate("nope", LATER);
    expect(moved()).toEqual([]);
  });

  describe("undo", () => {
    it("offers the move, naming both days and the links it cut", () => {
      app().moveTaskToDate("a", LATER);
      expect(app().lastMoved).toMatchObject({
        from: TODAY,
        to: LATER,
        deps: { b: ["a"] },
      });
      expect(app().lastMoved!.tasks.map((t) => t.title)).toEqual(["Alpha"]);
    });

    it("brings the task back with its state and its links", () => {
      app().moveTaskToDate("a", LATER);
      app().undoMove();
      expect(moved()).toEqual([]);
      expect(task("a")).toMatchObject({
        title: "Alpha",
        status: "done",
        fixedStart: at(10),
      });
      expect(task("b")!.dependsOn).toEqual(["a"]);
      expect(app().lastMoved).toBeNull();
    });

    it("restores a mid-run task exactly as it was", () => {
      app().startTask("b");
      vi.setSystemTime(new Date(2026, 6, 28, 9, 30, 0));
      app().moveTaskToDate("b", LATER);
      app().undoMove();
      expect(task("b")).toMatchObject({
        status: "active",
        actualStart: at(9),
        actualMinutes: 0,
      });
    });

    it("works from a different day than the one it was offered on", () => {
      app().moveTaskToDate("a", LATER);
      app().setDate("2026-09-09");
      app().undoMove();
      expect(app().plan.days[TODAY].tasks.map((t) => t.title)).toContain("Alpha");
      expect(app().plan.days[LATER].tasks).toEqual([]);
    });

    it("keeps a defer undoable too", () => {
      app().deferToNextDay("b");
      app().undoLast();
      expect(titles()).toEqual(["Alpha", "Beta"]);
      expect(app().plan.days[TOMORROW].tasks).toEqual([]);
    });

    it("puts only one offer on the table at a time", () => {
      app().moveTaskToDate("b", LATER);
      app().clearDone();
      expect(app().lastMoved).toBeNull();
      expect(app().lastCleared).not.toBeNull();

      app().undoClear();
      app().moveTaskToDate("a", LATER);
      expect(app().lastCleared).toBeNull();
      expect(app().lastMoved).not.toBeNull();
    });

    it("undoes the clear when no move is pending", () => {
      app().clearDone();
      app().undoLast();
      expect(task("a")).toBeDefined();
    });
  });
});

describe("moving a day's unfinished work", () => {
  const LATER = "2026-08-05";
  const moved = () => app().plan.days[LATER]?.tasks ?? [];
  const movedTitles = () => moved().map((t) => t.title);
  const dep = (title: string) =>
    moved().find((t) => t.title === title)!.dependsOn;

  beforeEach(() =>
    load(
      makeDay([
        makeTask({ id: "done", title: "Shipped", status: "done" }),
        makeTask({ id: "a", title: "Alpha", dependsOn: ["done"] }),
        makeTask({ id: "b", title: "Beta", dependsOn: ["a"] }),
        makeTask({
          id: "c",
          title: "Gamma",
          blocked: "waiting on bob",
          dependsOn: ["b"],
        }),
        makeTask({ id: "late", title: "Wrapped", status: "done", dependsOn: ["b"] }),
      ])
    )
  );

  it("takes everything unfinished and leaves the finished work behind", () => {
    app().moveUnfinishedToDate(LATER);
    expect(titles()).toEqual(["Shipped", "Wrapped"]);
    expect(movedTitles()).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("keeps the dependencies between the tasks that travel together", () => {
    app().moveUnfinishedToDate(LATER);
    expect(dep("Beta")).toEqual(["a"]);
    expect(dep("Gamma")).toEqual(["b"]);
  });

  it("cuts only the links that would have crossed the day boundary", () => {
    app().moveUnfinishedToDate(LATER);
    expect(dep("Alpha")).toEqual([]); // it waited on work that stayed behind
    expect(task("late")!.dependsOn).toEqual([]);
  });

  it("keeps the queue in the order it was in", () => {
    app().setDate(LATER);
    app().quickAdd("Already there");
    app().setDate(TODAY);
    app().moveTaskToDate("c", LATER); // Gamma goes on ahead of the others
    app().moveUnfinishedToDate(LATER);
    expect(movedTitles()).toEqual(["Already there", "Gamma", "Alpha", "Beta"]);
    expect(moved().map((t) => t.order)).toEqual([1, 2, 3, 4]);
  });

  it("carries a blocker and a pinned time across", () => {
    app().updateTask("b", { fixedStart: at(10) });
    app().moveUnfinishedToDate(LATER);
    expect(moved().find((t) => t.title === "Gamma")!.blocked).toBe("waiting on bob");
    expect(moved().find((t) => t.title === "Beta")!.fixedStart).toBe(at(10));
  });

  it("banks the time on whatever was running", () => {
    app().startTask("a");
    vi.setSystemTime(new Date(2026, 6, 28, 9, 30, 0));
    app().moveUnfinishedToDate(LATER);
    expect(moved().find((t) => t.title === "Alpha")).toMatchObject({
      status: "todo",
      actualStart: null,
      actualMinutes: 30,
    });
  });

  it("does nothing when the day has no unfinished work left", () => {
    app().moveUnfinishedToDate(LATER);
    app().dismissMove();
    app().moveUnfinishedToDate("2026-08-06");
    expect(app().plan.days["2026-08-06"]).toBeUndefined();
    expect(app().lastMoved).toBeNull();
  });

  it("puts the whole batch back on undo, links and all", () => {
    app().moveUnfinishedToDate(LATER);
    app().undoMove();
    expect(titles().sort()).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
      "Shipped",
      "Wrapped",
    ]);
    expect(task("a")!.dependsOn).toEqual(["done"]);
    expect(task("b")!.dependsOn).toEqual(["a"]);
    expect(task("late")!.dependsOn).toEqual(["b"]);
    expect(moved()).toEqual([]);
  });
});

describe("day bounds", () => {
  beforeEach(() => load());

  it("sets the working window", () => {
    app().setDayBounds(at(7), at(19));
    expect(app().plan.days[TODAY]).toMatchObject({ dayStart: at(7), dayEnd: at(19) });
  });

  it("keeps the day at least an hour long", () => {
    app().setDayBounds(at(9), at(8));
    expect(app().plan.days[TODAY].dayEnd).toBe(at(10));
  });
});

describe("goals", () => {
  beforeEach(() => load(makeDay([makeTask({ id: "a", goalId: "g1" })])));

  it("adds a goal, trimming the name", () => {
    app().addGoal("  reading  ");
    expect(app().plan.goals.map((g) => g.name)).toEqual(["deep-work", "reading"]);
  });

  it("ignores blank and duplicate names", () => {
    app().addGoal("   ");
    app().addGoal("DEEP-WORK");
    expect(app().plan.goals).toHaveLength(1);
  });

  it("unassigns the goal from every day's tasks when deleted", () => {
    app().shiftDate(1);
    const other = app().quickAdd("Tomorrow task #deep-work")!;
    app().shiftDate(-1);
    app().deleteGoal("g1");
    expect(task("a")!.goalId).toBeNull();
    expect(
      app().plan.days[TOMORROW].tasks.find((t) => t.id === other)!.goalId
    ).toBeNull();
  });
});

describe("clearing finished work", () => {
  beforeEach(() =>
    load(
      makeDay([
        makeTask({ id: "done1", title: "Done one", status: "done" }),
        makeTask({ id: "done2", title: "Done two", status: "done" }),
        makeTask({ id: "todo", title: "Still to do", dependsOn: ["done1"] }),
      ])
    )
  );

  it("removes the day's finished tasks and the links pointing at them", () => {
    app().clearDone();
    expect(titles()).toEqual(["Still to do"]);
    expect(task("todo")!.dependsOn).toEqual([]);
  });

  it("records the batch so it can be undone", () => {
    app().clearDone();
    expect(app().lastCleared).toMatchObject({
      date: TODAY,
      deps: { todo: ["done1"] },
    });
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

  it("restores to the day the tasks came from, not the day on screen", () => {
    app().clearDone();
    app().shiftDate(1);
    app().undoClear();
    expect(app().plan.days[TODAY].tasks).toHaveLength(3);
    expect(app().plan.days[TOMORROW].tasks).toHaveLength(0);
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

  it("only clears the day on screen", () => {
    app().shiftDate(1);
    app().quickAdd("Tomorrow task");
    const tomorrowId = app().plan.days[TOMORROW].tasks[0].id;
    app().toggleDone(tomorrowId);
    app().shiftDate(-1);
    app().clearDone();
    expect(app().plan.days[TOMORROW].tasks).toHaveLength(1);
  });
});

describe("flowchart layout", () => {
  it("gives every task a position, keeping dependents to the right", () => {
    load(
      makeDay([
        makeTask({ id: "a" }),
        makeTask({ id: "b", dependsOn: ["a"] }),
      ])
    );
    app().ensureFlowPositions();
    expect(task("a")!.flowX).toBe(40);
    expect(task("b")!.flowX!).toBeGreaterThan(task("a")!.flowX!);
    expect(tasks().every((t) => t.flowY != null)).toBe(true);
  });

  it("leaves positions that already exist alone", () => {
    load(makeDay([makeTask({ id: "a", flowX: 999, flowY: 111 })]));
    app().ensureFlowPositions();
    expect(task("a")).toMatchObject({ flowX: 999, flowY: 111 });
  });

  it("drops parallel tasks into the background band", () => {
    load(makeDay([makeTask({ id: "ci", parallel: true })]));
    app().ensureFlowPositions();
    expect(task("ci")!.flowY!).toBeGreaterThanOrEqual(FLOW.PAR_Y);
  });

  it("re-lays the whole graph by depth on auto-arrange", () => {
    load(
      makeDay([
        makeTask({ id: "a", flowX: 999, flowY: 999 }),
        makeTask({ id: "b", dependsOn: ["a"], flowX: 0, flowY: 0 }),
        makeTask({ id: "c", dependsOn: ["b"] }),
      ])
    );
    app().autoArrangeFlow();
    expect(task("a")!.flowX).toBe(40);
    expect(task("b")!.flowX).toBe(290);
    expect(task("c")!.flowX).toBe(540);
  });

  it("stacks tasks at the same depth without overlapping", () => {
    load(makeDay([makeTask({ id: "a" }), makeTask({ id: "b" })]));
    app().autoArrangeFlow();
    expect(task("a")!.flowX).toBe(task("b")!.flowX);
    expect(task("a")!.flowY).not.toBe(task("b")!.flowY);
  });
});

describe("loading", () => {
  it("takes a plan from the server and marks itself ready", () => {
    app().load(makePlan([makeDay([makeTask({ title: "From the server" })])]));
    expect(app().loaded).toBe(true);
    expect(app().plan.days[TODAY].tasks[0].title).toBe("From the server");
  });

  it("keeps the seeded plan on a first run with no saved data", () => {
    const seeded = app().plan;
    app().load(null);
    expect(app().loaded).toBe(true);
    expect(app().plan).toBe(seeded);
  });

  it("ensures today's day exists after loading", () => {
    app().load(makePlan([makeDay([], { date: "2020-01-01" })]));
    expect(app().plan.days[TODAY]).toBeDefined();
  });
});
