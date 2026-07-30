import TaskList from "@/components/TaskList";
import { scheduleDay } from "@/lib/scheduler";
import { DayPlan } from "@/lib/types";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, seedStore } from "../app-state";
import { at, makeDay, makeTask, resetFactory } from "../factory";

function renderList(day: DayPlan) {
  seedStore(day);
  return render(<TaskList slots={scheduleDay(day, at(9))} />);
}

const row = (title: string) =>
  screen.getByText(title).closest("[data-task-row]") as HTMLElement;

beforeEach(() => {
  resetFactory();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 6, 28, 9, 0, 0));
});

describe("moving the day's work", () => {
  const dayWithWork = () =>
    makeDay([
      makeTask({ id: "a", title: "First" }),
      makeTask({ id: "b", title: "Second", dependsOn: ["a"] }),
      makeTask({ id: "d", title: "Finished thing", status: "done" }),
    ]);

  it("offers the move only while something is unfinished", () => {
    renderList(makeDay([makeTask({ title: "Finished thing", status: "done" })]));
    expect(
      screen.queryByRole("button", { name: /move all/ })
    ).not.toBeInTheDocument();
  });

  it("keeps the picker shut until asked, then aims at today", async () => {
    const user = userEvent.setup();
    renderList(dayWithWork());
    expect(
      screen.queryByLabelText("Move all unfinished tasks to")
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /move all/ }));
    expect(screen.getByLabelText("Move all unfinished tasks to")).toHaveValue(
      "2026-07-28"
    );
    // today is the day on screen, so there is nowhere to send them yet
    expect(screen.getByRole("button", { name: /move 2/ })).toBeDisabled();
  });

  it("sends the unfinished tasks on together, dependencies intact", async () => {
    const user = userEvent.setup();
    renderList(dayWithWork());
    await user.click(screen.getByRole("button", { name: /move all/ }));
    await user.click(screen.getByRole("button", { name: "+1 week" }));
    await user.click(screen.getByRole("button", { name: /move 2/ }));

    const target = app().plan.days["2026-08-04"].tasks;
    expect(target.map((t) => t.title)).toEqual(["First", "Second"]);
    expect(target[1].dependsOn).toEqual(["a"]);
    expect(app().plan.days["2026-07-28"].tasks.map((t) => t.title)).toEqual([
      "Finished thing",
    ]);
    expect(screen.getByText(/Nothing queued/)).toBeInTheDocument();
  });
});

describe("sections", () => {
  it("splits tasks into queue, blocked and done", () => {
    renderList(
      makeDay([
        makeTask({ id: "q", title: "Queued thing" }),
        makeTask({ id: "b", title: "Blocked thing", blocked: "waiting on legal" }),
        makeTask({ id: "d", title: "Finished thing", status: "done" }),
      ])
    );
    expect(screen.getByText(/Queue · 1/)).toBeInTheDocument();
    expect(screen.getByText(/Blocked · 1/)).toBeInTheDocument();
    expect(screen.getByText(/Done · 1/)).toBeInTheDocument();
  });

  it("hides the blocked and done sections when there is nothing in them", () => {
    renderList(makeDay([makeTask({ title: "Only thing" })]));
    expect(screen.queryByText(/Blocked ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Done ·/)).not.toBeInTheDocument();
  });

  it("prompts when the queue is empty", () => {
    renderList(makeDay([]));
    expect(screen.getByText(/Nothing queued/)).toBeInTheDocument();
  });

  it("collapses and expands the done list", async () => {
    const user = userEvent.setup();
    renderList(makeDay([makeTask({ title: "Finished thing", status: "done" })]));
    expect(screen.getByText("Finished thing")).toBeVisible();
    await user.click(screen.getByText(/Done · 1/));
    expect(screen.queryByText("Finished thing")).not.toBeInTheDocument();
  });

  it("orders the queue by scheduled start, not by array position", () => {
    renderList(
      makeDay([
        makeTask({ id: "late", title: "Later", order: 2 }),
        makeTask({ id: "early", title: "Earlier", order: 1 }),
      ])
    );
    const rendered = screen.getAllByText(/Earlier|Later/).map((n) => n.textContent);
    expect(rendered).toEqual(["Earlier", "Later"]);
  });
});

describe("row detail", () => {
  it("shows duration, scheduled start and the goal chip", () => {
    renderList(makeDay([makeTask({ title: "Write report", duration: 45, goalId: "g1" })]));
    const r = row("Write report");
    expect(within(r).getByText("45m")).toBeInTheDocument();
    expect(within(r).getByText("09:00")).toBeInTheDocument();
    expect(within(r).getByText("deep-work")).toBeInTheDocument();
  });

  it("flags a blocked task with its reason", () => {
    renderList(makeDay([makeTask({ title: "Ship it", blocked: "waiting on legal" })]));
    expect(screen.getByText(/waiting on legal/)).toBeInTheDocument();
  });

  it("marks work that will not fit before the end of the day", () => {
    renderList(makeDay([makeTask({ title: "Huge job", duration: 600 })], { dayEnd: at(10) }));
    expect(screen.getByText(/won't fit/)).toBeInTheDocument();
  });

  it("counts dependencies", () => {
    renderList(
      makeDay([
        makeTask({ id: "a", title: "First" }),
        makeTask({ id: "b", title: "Second", dependsOn: ["a"] }),
      ])
    );
    expect(within(row("Second")).getByTitle("has dependencies")).toHaveTextContent("1");
  });
});

describe("row actions", () => {
  it("marks a task done from the row button", async () => {
    const user = userEvent.setup();
    renderList(makeDay([makeTask({ id: "a", title: "Write report" })]));
    await user.click(within(row("Write report")).getByRole("button", { name: /done/i }));
    expect(app().plan.days["2026-07-28"].tasks[0].status).toBe("done");
  });

  it("reopens a finished task", async () => {
    const user = userEvent.setup();
    renderList(makeDay([makeTask({ id: "a", title: "Write report", status: "done" })]));
    await user.click(within(row("Write report")).getByRole("button", { name: /reopen/i }));
    expect(app().plan.days["2026-07-28"].tasks[0].status).toBe("todo");
  });

  it("exposes the circle as a checkbox naming its task", async () => {
    const user = userEvent.setup();
    renderList(makeDay([makeTask({ id: "a", title: "Write report" })]));
    const box = screen.getByRole("checkbox", { name: "Write report" });
    expect(box).toHaveAttribute("aria-checked", "false");
    await user.click(box);
    expect(app().plan.days["2026-07-28"].tasks[0].status).toBe("done");
    expect(screen.getByRole("checkbox", { name: "Write report" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("starts and pauses the timer", async () => {
    const user = userEvent.setup();
    renderList(makeDay([makeTask({ id: "a", title: "Write report" })]));
    await user.click(screen.getByRole("button", { name: "start" }));
    expect(app().plan.days["2026-07-28"].tasks[0].status).toBe("active");
    await user.click(screen.getByRole("button", { name: "pause" }));
    expect(app().plan.days["2026-07-28"].tasks[0].status).toBe("todo");
  });

  it("offers no start button for blocked or finished tasks", () => {
    renderList(
      makeDay([
        makeTask({ title: "Blocked thing", blocked: "waiting" }),
        makeTask({ title: "Finished thing", status: "done" }),
      ])
    );
    expect(screen.queryByRole("button", { name: "start" })).not.toBeInTheDocument();
  });

  it("selects a task on click and opens the editor on double click", async () => {
    const user = userEvent.setup();
    renderList(makeDay([makeTask({ id: "a", title: "Write report" })]));
    await user.click(screen.getByText("Write report"));
    expect(app().selectedId).toBe("a");
    await user.dblClick(screen.getByText("Write report"));
    expect(app().editorOpen).toBe(true);
  });
});

describe("clearing finished work", () => {
  const withDone = () =>
    makeDay([
      makeTask({ id: "a", title: "Still going" }),
      makeTask({ id: "b", title: "Finished thing", status: "done" }),
    ]);

  it("offers a clear control only when something is finished", () => {
    renderList(makeDay([makeTask({ title: "Still going" })]));
    expect(screen.queryByTitle(/remove finished tasks/)).not.toBeInTheDocument();
  });

  it("clears the day's finished tasks", async () => {
    const user = userEvent.setup();
    renderList(withDone());
    await user.click(screen.getByTitle(/remove finished tasks/));
    expect(app().plan.days["2026-07-28"].tasks.map((t) => t.title)).toEqual([
      "Still going",
    ]);
  });

  it("leaves an undo offer behind", async () => {
    const user = userEvent.setup();
    renderList(withDone());
    await user.click(screen.getByTitle(/remove finished tasks/));
    expect(app().lastCleared?.tasks).toHaveLength(1);
  });
});
