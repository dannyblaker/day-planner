import Timeline from "@/components/Timeline";
import { scheduleDay } from "@/lib/scheduler";
import { DayPlan, Goal } from "@/lib/types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { at, makeDay, makeTask, resetFactory } from "../factory";

const goals: Goal[] = [{ id: "g1", name: "deep-work", color: "#818cf8" }];

function renderTimeline(day: DayPlan, props: Record<string, unknown> = {}) {
  return render(
    <Timeline
      day={day}
      slots={scheduleDay(day, at(9))}
      now={at(9)}
      goals={goals}
      isToday
      {...props}
    />
  );
}

beforeEach(resetFactory);

describe("drawing the day", () => {
  it("renders a block per scheduled task with its time range", () => {
    renderTimeline(
      makeDay([
        makeTask({ title: "Write report", duration: 60 }),
        makeTask({ title: "Review PRs", duration: 30 }),
      ])
    );
    expect(screen.getByText("Write report")).toBeInTheDocument();
    expect(screen.getByText("09:00–10:00")).toBeInTheDocument();
    expect(screen.getByText("10:00–10:30")).toBeInTheDocument();
  });

  it("labels the hours of the day", () => {
    renderTimeline(makeDay([]));
    expect(screen.getByText("08:00")).toBeInTheDocument();
    expect(screen.getByText("18:00")).toBeInTheDocument();
    expect(screen.getByText(/day ends 18:00/)).toBeInTheDocument();
  });

  it("marks a pinned task and shows the parallel lane only when used", () => {
    renderTimeline(makeDay([makeTask({ title: "Standup", fixedStart: at(10) })]));
    expect(screen.getByTitle("fixed time")).toBeInTheDocument();
    expect(screen.queryByText("parallel")).not.toBeInTheDocument();
  });

  it("opens the parallel lane when a background task exists", () => {
    renderTimeline(makeDay([makeTask({ title: "CI run", parallel: true })]));
    expect(screen.getByText("parallel")).toBeInTheDocument();
  });

  it("shows the goal chip and flags overflow", () => {
    renderTimeline(
      makeDay([makeTask({ title: "Huge job", duration: 600, goalId: "g1" })], {
        dayEnd: at(10),
      })
    );
    expect(screen.getByText("deep-work")).toBeInTheDocument();
    expect(screen.getByText(/past day end/)).toBeInTheDocument();
  });

  it("warns when a task is waiting on a blocked dependency", () => {
    renderTimeline(
      makeDay([
        makeTask({ id: "a", title: "Blocked one", blocked: "waiting" }),
        makeTask({ id: "b", title: "Dependent one", dependsOn: ["a"] }),
      ])
    );
    expect(screen.getByText(/waiting on blocked dep/)).toBeInTheDocument();
  });

  it("draws the now marker only for today", () => {
    const day = makeDay([makeTask({ title: "Anything" })]);
    const { unmount } = renderTimeline(day);
    expect(screen.getByText("09:00", { selector: "span.font-medium" })).toBeInTheDocument();
    unmount();
    renderTimeline(day, { isToday: false });
    expect(
      screen.queryByText("09:00", { selector: "span.font-medium" })
    ).not.toBeInTheDocument();
  });
});

describe("interaction", () => {
  it("selects a task when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderTimeline(makeDay([makeTask({ id: "a", title: "Write report" })]), { onSelect });
    await user.click(screen.getByText("Write report"));
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("opens the editor when a block is double-clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderTimeline(makeDay([makeTask({ id: "a", title: "Write report" })]), {
      onSelect: vi.fn(),
      onEdit,
    });
    await user.dblClick(screen.getByText("Write report"));
    expect(onEdit).toHaveBeenCalledWith("a");
  });

  it("does not open the editor when the done button is double-clicked", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderTimeline(makeDay([makeTask({ id: "a", title: "Write report" })]), {
      onEdit,
      onToggleDone: vi.fn(),
    });
    await user.dblClick(screen.getByLabelText("Mark task done"));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("marks a task done from the block", async () => {
    const user = userEvent.setup();
    const onToggleDone = vi.fn();
    renderTimeline(makeDay([makeTask({ id: "a", title: "Write report" })]), {
      onToggleDone,
    });
    await user.click(screen.getByLabelText("Mark task done"));
    expect(onToggleDone).toHaveBeenCalledWith("a");
  });

  it("does not also select the task when the done button is pressed", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderTimeline(makeDay([makeTask({ id: "a", title: "Write report" })]), {
      onSelect,
      onToggleDone: vi.fn(),
    });
    await user.click(screen.getByLabelText("Mark task done"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("offers reopen on a finished block", () => {
    renderTimeline(
      makeDay([
        makeTask({ title: "Done thing", status: "done", actualStart: at(8), actualMinutes: 30 }),
      ]),
      { onToggleDone: vi.fn() }
    );
    expect(screen.getByLabelText("Reopen task")).toBeInTheDocument();
  });
});

describe("read-only mode (the share view)", () => {
  it("draws no done button when no handler is given", () => {
    renderTimeline(makeDay([makeTask({ title: "Write report" })]));
    expect(screen.queryByLabelText(/Mark task done|Reopen task/)).toBeNull();
  });

  it("is inert on click", async () => {
    const user = userEvent.setup();
    renderTimeline(makeDay([makeTask({ title: "Write report" })]));
    await user.click(screen.getByText("Write report"));
    // nothing to assert but the absence of a crash: no handlers are wired
    expect(screen.getByText("Write report")).toBeInTheDocument();
  });
});
