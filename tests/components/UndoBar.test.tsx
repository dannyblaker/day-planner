import UndoBar from "@/components/UndoBar";
import { fmtDateHuman } from "@/lib/time";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, seedStore } from "../app-state";
import { makeDay, makeTask, resetFactory } from "../factory";

const dayWithFinishedWork = () =>
  makeDay([
    makeTask({ id: "a", title: "Still going" }),
    makeTask({ id: "b", title: "Finished one", status: "done" }),
    makeTask({ id: "c", title: "Finished two", status: "done" }),
  ]);

beforeEach(() => {
  resetFactory();
  seedStore(dayWithFinishedWork());
});

describe("visibility", () => {
  it("stays out of the way until something is cleared", () => {
    render(<UndoBar />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("appears with a count once a clear happens", () => {
    render(<UndoBar />);
    act(() => app().clearDone());
    expect(screen.getByRole("status")).toHaveTextContent("Cleared 2 done tasks");
  });

  it("says 'task' when only one was cleared", () => {
    seedStore(makeDay([makeTask({ title: "Finished one", status: "done" })]));
    render(<UndoBar />);
    act(() => app().clearDone());
    expect(screen.getByRole("status")).toHaveTextContent("Cleared 1 done task");
  });
});

describe("acting on the offer", () => {
  it("restores the tasks when undo is pressed", async () => {
    const user = userEvent.setup();
    render(<UndoBar />);
    act(() => app().clearDone());
    await user.click(screen.getByRole("button", { name: /undo/i }));
    expect(app().plan.days["2026-07-28"].tasks).toHaveLength(3);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismisses without restoring", async () => {
    const user = userEvent.setup();
    render(<UndoBar />);
    act(() => app().clearDone());
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(app().plan.days["2026-07-28"].tasks).toHaveLength(1);
  });
});

describe("a task sent to another day", () => {
  const LATER = "2026-08-05";
  const moveIt = () => act(() => app().moveTaskToDate("a", LATER));

  it("says where it went", () => {
    render(<UndoBar />);
    moveIt();
    expect(screen.getByRole("status")).toHaveTextContent(
      `Moved “Still going” to ${fmtDateHuman(LATER)}`
    );
  });

  it("brings it back on undo, and leaves the day it went to empty", async () => {
    const user = userEvent.setup();
    render(<UndoBar />);
    moveIt();
    await user.click(screen.getByRole("button", { name: /undo/i }));
    expect(app().plan.days["2026-07-28"].tasks.map((t) => t.title)).toContain(
      "Still going"
    );
    expect(app().plan.days[LATER].tasks).toEqual([]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers to follow the task to its new day", async () => {
    const user = userEvent.setup();
    render(<UndoBar />);
    moveIt();
    await user.click(screen.getByRole("button", { name: /go there/ }));
    expect(app().date).toBe(LATER);
    expect(app().plan.days[LATER].tasks.map((t) => t.title)).toEqual([
      "Still going",
    ]);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismisses without moving it back", async () => {
    const user = userEvent.setup();
    render(<UndoBar />);
    moveIt();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(app().plan.days[LATER].tasks).toHaveLength(1);
  });

  it("gives up on the offer after ten seconds, leaving the move in place", () => {
    vi.useFakeTimers();
    render(<UndoBar />);
    moveIt();
    act(() => vi.advanceTimersByTime(10_500));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(app().plan.days[LATER].tasks).toHaveLength(1);
  });
});

describe("expiry", () => {
  it("gives up after ten seconds, leaving the clear in place", () => {
    vi.useFakeTimers();
    render(<UndoBar />);
    act(() => app().clearDone());
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(9_000));
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_500));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(app().plan.days["2026-07-28"].tasks).toHaveLength(1);
  });

  it("restarts the clock for a second clear", () => {
    vi.useFakeTimers();
    render(<UndoBar />);
    act(() => app().clearDone());
    act(() => vi.advanceTimersByTime(9_000));

    // finish something else and clear again — the offer should not expire early
    act(() => {
      app().toggleDone("a");
      app().clearDone();
    });
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
