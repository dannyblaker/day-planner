import { SWEEP_MS, useAutoDelete } from "@/lib/auto-delete";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, seedStore } from "./app-state";
import { makeTask, resetFactory } from "./factory";

/** the hook on its own, with the store behind it */
function Sweeper() {
  useAutoDelete();
  return null;
}

const titles = () => app().plan.tasks.map((t) => t.title);
const counting = () => Object.keys(app().sweepAt).sort();

/** long enough for the countdown to run out, plus a tick to notice */
const waitOut = () => act(() => void vi.advanceTimersByTime(SWEEP_MS + 500));

beforeEach(() => {
  resetFactory();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 28, 9, 0, 0));
  document.documentElement.dataset.sweep = "on";
});

describe("sweeping finished work away", () => {
  it("counts a finished task down and then deletes it", () => {
    seedStore([makeTask({ id: "a", title: "Write it" })]);
    render(<Sweeper />);

    act(() => app().setDone("a", true));
    expect(counting()).toEqual(["a"]);
    expect(titles()).toEqual(["Write it"]); // still there, still recoverable

    waitOut();
    expect(titles()).toEqual([]);
    expect(counting()).toEqual([]);
  });

  /**
   * The ordinary way round: the task didn't exist when the watch started. It has
   * to be seen unfinished and then finished, which means noticing every edit and
   * not just the ones that change what is settled.
   */
  it("sweeps a task that was added after it started watching", () => {
    seedStore([]);
    render(<Sweeper />);

    let id = "";
    act(() => void (id = app().quickAdd("Write it")!));
    waitOut();
    expect(titles()).toEqual(["Write it"]);

    act(() => app().setDone(id, true));
    expect(counting()).toEqual([id]);
    waitOut();
    expect(titles()).toEqual([]);
  });

  it("stops the countdown when the task is re-opened in time", () => {
    seedStore([makeTask({ id: "a", title: "Write it" })]);
    render(<Sweeper />);

    act(() => app().setDone("a", true));
    act(() => void vi.advanceTimersByTime(2000));
    act(() => app().setDone("a", false));
    expect(counting()).toEqual([]);

    waitOut();
    expect(titles()).toEqual(["Write it"]);
  });

  /** the countdown is the undo, so it must not restart under you */
  it("does not restart the clock on an unrelated edit", () => {
    seedStore([
      makeTask({ id: "a", title: "Write it" }),
      makeTask({ id: "b", title: "Something else" }),
    ]);
    render(<Sweeper />);

    act(() => app().setDone("a", true));
    const deadline = app().sweepAt.a;
    act(() => void vi.advanceTimersByTime(3000));
    act(() => app().updateTask("b", { title: "Renamed" }));
    expect(app().sweepAt.a).toBe(deadline);

    act(() => void vi.advanceTimersByTime(2500));
    expect(titles()).toEqual(["Renamed"]);
  });

  it("holds a finished task while something still waits on it", () => {
    seedStore([
      makeTask({ id: "a", title: "First" }),
      makeTask({ id: "b", title: "Second", dependsOn: ["a"] }),
    ]);
    render(<Sweeper />);

    act(() => app().setDone("a", true));
    expect(counting()).toEqual([]);
    waitOut();
    expect(titles()).toEqual(["First", "Second"]);

    // the last of the chain finishing is what starts it, and then both go
    act(() => app().setDone("b", true));
    expect(counting()).toEqual(["a", "b"]);
    waitOut();
    expect(titles()).toEqual([]);
  });

  /**
   * Opening the app should not start a five-second countdown on work finished
   * last week. What the sweep watched finish is what it takes.
   */
  it("leaves work that was already finished when it started watching", () => {
    seedStore([
      makeTask({ id: "old", title: "Finished last week", done: true }),
      makeTask({ id: "new", title: "Finishing now" }),
    ]);
    render(<Sweeper />);

    waitOut();
    expect(titles()).toEqual(["Finished last week", "Finishing now"]);

    act(() => app().setDone("new", true));
    waitOut();
    expect(titles()).toEqual(["Finished last week"]);
  });

  it("sweeps work it saw finish, even if it was finished once before", () => {
    seedStore([makeTask({ id: "a", title: "Write it", done: true })]);
    render(<Sweeper />);

    act(() => app().setDone("a", false));
    act(() => app().setDone("a", true));
    waitOut();
    expect(titles()).toEqual([]);
  });

  /** Putting tasks back is not a reason to take them away again. */
  it("leaves tasks that an undone clear has just put back", () => {
    seedStore([
      makeTask({ id: "a", title: "Finished one" }),
      makeTask({ id: "b", title: "Still going" }),
    ]);
    render(<Sweeper />);

    act(() => app().setDone("a", true));
    act(() => app().clearDone());
    expect(titles()).toEqual(["Still going"]);

    act(() => app().undoClear());
    expect(counting()).toEqual([]);
    waitOut();
    expect(titles().sort()).toEqual(["Finished one", "Still going"]);
  });

  it("starts watching afresh when the sweep is switched back on", () => {
    seedStore([makeTask({ id: "a", title: "Write it" })]);
    render(<Sweeper />);

    act(() => app().setSweep(false));
    act(() => app().setDone("a", true));
    act(() => app().setSweep(true));

    // it finished while nobody was watching, so it is left where it is
    waitOut();
    expect(titles()).toEqual(["Write it"]);
  });

  it("does nothing at all when the sweep is off", () => {
    seedStore([makeTask({ id: "a", title: "Write it" })]);
    document.documentElement.dataset.sweep = "off";
    render(<Sweeper />);

    act(() => app().setDone("a", true));
    waitOut();
    expect(titles()).toEqual(["Write it"]);
    expect(counting()).toEqual([]);
  });

  it("cancels what was counting down when the sweep is switched off", () => {
    seedStore([makeTask({ id: "a", title: "Write it" })]);
    render(<Sweeper />);

    act(() => app().setDone("a", true));
    expect(counting()).toEqual(["a"]);
    act(() => app().setSweep(false));
    expect(counting()).toEqual([]);

    waitOut();
    expect(titles()).toEqual(["Write it"]);
  });
});
