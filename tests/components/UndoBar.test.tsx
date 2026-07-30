import UndoBar from "@/components/UndoBar";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, seedStore } from "../app-state";
import { makeTask, resetFactory } from "../factory";

const boardWithFinishedWork = () =>
  [
    makeTask({ id: "a", title: "Still going" }),
    makeTask({ id: "b", title: "Finished one", done: true }),
    makeTask({ id: "c", title: "Finished two", done: true }),
  ];

beforeEach(() => {
  resetFactory();
  seedStore(boardWithFinishedWork());
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
    seedStore([makeTask({ title: "Finished one", done: true })]);
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
    expect(app().plan.tasks).toHaveLength(3);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismisses without restoring", async () => {
    const user = userEvent.setup();
    render(<UndoBar />);
    act(() => app().clearDone());
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(app().plan.tasks).toHaveLength(1);
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
    expect(app().plan.tasks).toHaveLength(1);
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
