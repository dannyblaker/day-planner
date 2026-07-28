import {
  dependentsOf,
  flowDepths,
  plannedFocusMinutes,
  scheduleDay,
} from "@/lib/scheduler";
import { Slot } from "@/lib/types";
import { beforeEach, describe, expect, it } from "vitest";
import { at, makeDay, makeTask, resetFactory } from "./factory";

beforeEach(resetFactory);

const slotFor = (slots: Slot[], id: string) => slots.find((s) => s.task.id === id);
/** every slot as "id start-end lane", sorted — readable whole-schedule assertions */
const shape = (slots: Slot[]) =>
  [...slots]
    .sort((a, b) => a.start - b.start || a.task.id.localeCompare(b.task.id))
    .map((s) => `${s.task.id} ${s.start}-${s.end} ${s.lane}`);

describe("flexible packing", () => {
  it("packs queued tasks back to back from the start of the day", () => {
    const day = makeDay([
      makeTask({ id: "a", duration: 60, order: 1 }),
      makeTask({ id: "b", duration: 30, order: 2 }),
    ]);
    expect(shape(scheduleDay(day, at(8)))).toEqual([
      `a ${at(8)}-${at(9)} focus`,
      `b ${at(9)}-${at(9, 30)} focus`,
    ]);
  });

  it("packs in queue order, not array order", () => {
    const day = makeDay([
      makeTask({ id: "second", duration: 30, order: 2 }),
      makeTask({ id: "first", duration: 30, order: 1 }),
    ]);
    expect(shape(scheduleDay(day, at(8)))).toEqual([
      `first ${at(8)}-${at(8, 30)} focus`,
      `second ${at(8, 30)}-${at(9)} focus`,
    ]);
  });

  it("starts from now once the day is under way — running late reflows the rest", () => {
    const day = makeDay([makeTask({ id: "a", duration: 60 })]);
    expect(slotFor(scheduleDay(day, at(11, 20)), "a")).toMatchObject({
      start: at(11, 20),
      end: at(12, 20),
    });
  });

  it("waits for the start of the day when now is earlier", () => {
    const day = makeDay([makeTask({ id: "a", duration: 60 })]);
    expect(slotFor(scheduleDay(day, at(6)), "a")?.start).toBe(at(8));
  });

  it("counts only the time left on a partly worked task", () => {
    const day = makeDay([makeTask({ id: "a", duration: 60, actualMinutes: 25 })]);
    expect(slotFor(scheduleDay(day, at(8)), "a")?.end).toBe(at(8, 35));
  });

  it("keeps a 5-minute stub for a task that has already overrun", () => {
    const day = makeDay([makeTask({ id: "a", duration: 30, actualMinutes: 90 })]);
    expect(slotFor(scheduleDay(day, at(8)), "a")).toMatchObject({
      start: at(8),
      end: at(8, 5),
    });
  });
});

describe("fixed-time anchors", () => {
  it("anchors a meeting and marks the slot fixed", () => {
    const day = makeDay([makeTask({ id: "m", duration: 30, fixedStart: at(10) })]);
    expect(slotFor(scheduleDay(day, at(8)), "m")).toMatchObject({
      start: at(10),
      end: at(10, 30),
      fixed: true,
    });
  });

  it("packs flexible work into the gap before a meeting when it fits", () => {
    const day = makeDay([
      makeTask({ id: "meeting", duration: 30, fixedStart: at(10), order: 2 }),
      makeTask({ id: "work", duration: 60, order: 1 }),
    ]);
    expect(shape(scheduleDay(day, at(8)))).toEqual([
      `work ${at(8)}-${at(9)} focus`,
      `meeting ${at(10)}-${at(10, 30)} focus`,
    ]);
  });

  it("pushes flexible work past a meeting it would collide with", () => {
    const day = makeDay([
      makeTask({ id: "meeting", duration: 30, fixedStart: at(10), order: 2 }),
      makeTask({ id: "long", duration: 180, order: 1 }),
    ]);
    expect(shape(scheduleDay(day, at(8)))).toEqual([
      `meeting ${at(10)}-${at(10, 30)} focus`,
      `long ${at(10, 30)}-${at(13, 30)} focus`,
    ]);
  });

  it("lets a blocked meeting free its slot", () => {
    const day = makeDay([
      makeTask({ id: "meeting", duration: 30, fixedStart: at(10), blocked: "cancelled" }),
      makeTask({ id: "long", duration: 180 }),
    ]);
    expect(shape(scheduleDay(day, at(8)))).toEqual([`long ${at(8)}-${at(11)} focus`]);
  });
});

describe("dependencies", () => {
  it("never starts a task before its dependency finishes", () => {
    const day = makeDay([
      makeTask({ id: "a", duration: 60, order: 1 }),
      makeTask({ id: "b", duration: 30, order: 2, dependsOn: ["a"] }),
    ]);
    expect(slotFor(scheduleDay(day, at(8)), "b")?.start).toBe(at(9));
  });

  it("defers a dependent that sits earlier in the queue", () => {
    const day = makeDay([
      makeTask({ id: "b", duration: 30, order: 1, dependsOn: ["a"] }),
      makeTask({ id: "a", duration: 60, order: 2 }),
    ]);
    expect(shape(scheduleDay(day, at(8)))).toEqual([
      `a ${at(8)}-${at(9)} focus`,
      `b ${at(9)}-${at(9, 30)} focus`,
    ]);
  });

  it("waits for the latest of several dependencies", () => {
    const day = makeDay([
      makeTask({ id: "a", duration: 30, order: 1 }),
      makeTask({ id: "b", duration: 120, order: 2 }),
      makeTask({ id: "c", duration: 15, order: 3, dependsOn: ["a", "b"] }),
    ]);
    expect(slotFor(scheduleDay(day, at(8)), "c")?.start).toBe(at(10, 30));
  });

  it("treats a completed dependency as satisfied", () => {
    const day = makeDay([
      makeTask({ id: "a", duration: 60, order: 1, status: "done" }),
      makeTask({ id: "b", duration: 30, order: 2, dependsOn: ["a"] }),
    ]);
    expect(slotFor(scheduleDay(day, at(8)), "b")?.start).toBe(at(8));
  });

  it("ignores a dependency on a task that no longer exists", () => {
    const day = makeDay([makeTask({ id: "b", duration: 30, dependsOn: ["ghost"] })]);
    expect(slotFor(scheduleDay(day, at(8)), "b")).toMatchObject({
      start: at(8),
      waitingOn: [],
    });
  });

  it("schedules a task waiting on a blocked dependency, but flags it", () => {
    const day = makeDay([
      makeTask({ id: "a", duration: 60, order: 1, blocked: "waiting on legal" }),
      makeTask({ id: "b", duration: 30, order: 2, dependsOn: ["a"] }),
    ]);
    const slots = scheduleDay(day, at(8));
    expect(slotFor(slots, "a")).toBeUndefined();
    expect(slotFor(slots, "b")).toMatchObject({
      start: at(8),
      waitingOn: ["a"],
    });
  });

  it("still schedules both sides of a dependency cycle rather than hanging", () => {
    const day = makeDay([
      makeTask({ id: "a", duration: 30, order: 1, dependsOn: ["b"] }),
      makeTask({ id: "b", duration: 30, order: 2, dependsOn: ["a"] }),
    ]);
    const slots = scheduleDay(day, at(8));
    expect(slots).toHaveLength(2);
    // the cycle is broken at the first task, which is flagged as waiting;
    // placing it then satisfies the other, so only one carries the flag
    expect(slotFor(slots, "a")?.waitingOn).toEqual(["b"]);
    expect(slotFor(slots, "b")?.waitingOn).toEqual([]);
    expect(slots.every((s) => s.start >= at(8))).toBe(true);
  });
});

describe("the parallel lane", () => {
  it("runs background tasks concurrently with focus work", () => {
    const day = makeDay([
      makeTask({ id: "focus", duration: 60, order: 1 }),
      makeTask({ id: "ci", duration: 45, order: 2, parallel: true }),
    ]);
    expect(shape(scheduleDay(day, at(8)))).toEqual([
      `ci ${at(8)}-${at(8, 45)} background`,
      `focus ${at(8)}-${at(9)} focus`,
    ]);
  });

  it("does not let background work push focus work later", () => {
    const day = makeDay([
      makeTask({ id: "ci", duration: 240, order: 1, parallel: true }),
      makeTask({ id: "focus", duration: 30, order: 2 }),
    ]);
    expect(slotFor(scheduleDay(day, at(8)), "focus")?.start).toBe(at(8));
  });

  it("still honours dependencies across lanes", () => {
    const day = makeDay([
      makeTask({ id: "build", duration: 30, order: 1 }),
      makeTask({ id: "ci", duration: 45, order: 2, parallel: true, dependsOn: ["build"] }),
    ]);
    expect(slotFor(scheduleDay(day, at(8)), "ci")?.start).toBe(at(8, 30));
  });
});

describe("in-flight and finished work", () => {
  it("keeps a finished task where it actually ran", () => {
    const day = makeDay([
      makeTask({ id: "a", duration: 60, status: "done", actualStart: at(8), actualMinutes: 45 }),
    ]);
    expect(slotFor(scheduleDay(day, at(11)), "a")).toMatchObject({
      start: at(8),
      end: at(8, 45),
    });
  });

  it("falls back to the planned duration for a finished task with no timer", () => {
    const day = makeDay([
      makeTask({ id: "a", duration: 60, status: "done", actualStart: at(8), actualMinutes: 0 }),
    ]);
    expect(slotFor(scheduleDay(day, at(11)), "a")?.end).toBe(at(9));
  });

  it("leaves an untimed finished task off the timeline", () => {
    const day = makeDay([makeTask({ id: "a", status: "done", actualStart: null })]);
    expect(scheduleDay(day, at(11))).toHaveLength(0);
  });

  it("stretches the active task to at least now, so it never looks finished", () => {
    const day = makeDay([
      makeTask({ id: "a", duration: 30, status: "active", actualStart: at(8), actualMinutes: 0 }),
    ]);
    const slot = slotFor(scheduleDay(day, at(10)), "a");
    expect(slot).toMatchObject({ start: at(8) });
    expect(slot!.end).toBeGreaterThan(at(10));
  });

  it("keeps queued work from overlapping the active task", () => {
    const day = makeDay([
      makeTask({ id: "run", duration: 60, status: "active", actualStart: at(8), order: 1 }),
      makeTask({ id: "next", duration: 30, order: 2 }),
    ]);
    expect(slotFor(scheduleDay(day, at(8, 30)), "next")?.start).toBe(at(9));
  });
});

describe("overflow", () => {
  it("flags work that runs past the end of the day", () => {
    const day = makeDay([makeTask({ id: "a", duration: 120 })], { dayEnd: at(9) });
    expect(slotFor(scheduleDay(day, at(8)), "a")?.overflow).toBe(true);
  });

  it("does not flag work that ends exactly at the day end", () => {
    const day = makeDay([makeTask({ id: "a", duration: 60 })], { dayEnd: at(9) });
    expect(slotFor(scheduleDay(day, at(8)), "a")?.overflow).toBe(false);
  });
});

describe("plannedFocusMinutes", () => {
  it("adds up outstanding focus work", () => {
    const day = makeDay([
      makeTask({ duration: 60 }),
      makeTask({ duration: 30, status: "active", actualMinutes: 10 }),
    ]);
    expect(plannedFocusMinutes(day)).toBe(80);
  });

  it("excludes done, blocked and parallel work", () => {
    const day = makeDay([
      makeTask({ duration: 60, status: "done" }),
      makeTask({ duration: 60, blocked: "waiting" }),
      makeTask({ duration: 60, parallel: true }),
      makeTask({ duration: 25 }),
    ]);
    expect(plannedFocusMinutes(day)).toBe(25);
  });

  it("never counts an overrun task as negative time", () => {
    const day = makeDay([makeTask({ duration: 30, actualMinutes: 90 })]);
    expect(plannedFocusMinutes(day)).toBe(0);
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
