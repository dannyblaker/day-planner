import TaskList from "@/components/TaskList";
import { Task } from "@/lib/types";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, seedStore } from "../app-state";
import { makeTask, resetFactory } from "../factory";

function renderList(tasks: Task[]) {
  seedStore(tasks);
  return render(<TaskList />);
}

const row = (title: string) =>
  screen.getByText(title).closest("[data-task-row]") as HTMLElement;

beforeEach(() => {
  resetFactory();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 6, 28, 9, 0, 0));
});

describe("sections", () => {
  it("groups tasks by the status the graph derives", () => {
    renderList(
      [
        makeTask({ id: "a", title: "Startable thing" }),
        makeTask({ id: "w", title: "Waiting thing", dependsOn: ["a"] }),
        makeTask({ id: "b", title: "Blocked thing", blocked: "waiting on legal" }),
        makeTask({ id: "d", title: "Finished thing", done: true }),
      ]
    );
    expect(screen.getByText(/In progress · 1/)).toBeInTheDocument();
    // a blocker holds a task at to-do just as an unfinished prerequisite does
    expect(screen.getByText(/To do · 2/)).toBeInTheDocument();
    expect(screen.getByText(/Done · 1/)).toBeInTheDocument();
  });

  it("lists in-progress first — that group is what you can pick up now", () => {
    renderList(
      [
        makeTask({ id: "w", title: "Waiting thing", order: 1, dependsOn: ["a"] }),
        makeTask({ id: "a", title: "Startable thing", order: 2 }),
      ]
    );
    const rendered = screen
      .getAllByText(/Startable thing|Waiting thing/)
      .map((n) => n.textContent);
    expect(rendered).toEqual(["Startable thing", "Waiting thing"]);
  });

  it("promotes the dependents of a task as soon as it is done", async () => {
    const user = userEvent.setup();
    renderList(
      [
        makeTask({ id: "a", title: "First" }),
        makeTask({ id: "b", title: "Second", dependsOn: ["a"] }),
        makeTask({ id: "c", title: "Third", dependsOn: ["b"] }),
      ]
    );
    expect(screen.getByText(/In progress · 1/)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "First" }));
    // Second takes First's place on the frontier; Third still waits on Second
    expect(await screen.findByText(/In progress · 1/)).toBeInTheDocument();
    expect(screen.getByText(/To do · 1/)).toBeInTheDocument();
    expect(screen.getByText(/Done · 1/)).toBeInTheDocument();
  });

  it("hides a group when there is nothing in it", () => {
    renderList([makeTask({ title: "Only thing" })]);
    expect(screen.queryByText(/To do ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Done ·/)).not.toBeInTheDocument();
  });

  it("prompts when there is nothing at all", () => {
    renderList([]);
    expect(screen.getByText(/Empty swamp/)).toBeInTheDocument();
  });

  it("collapses and expands the done list", async () => {
    const user = userEvent.setup();
    renderList([makeTask({ title: "Finished thing", done: true })]);
    expect(screen.getByText("Finished thing")).toBeVisible();
    await user.click(screen.getByText(/Done · 1/));
    expect(screen.queryByText("Finished thing")).not.toBeInTheDocument();
  });

  it("orders within a group by queue position, not by array position", () => {
    renderList(
      [
        makeTask({ id: "late", title: "Later", order: 2 }),
        makeTask({ id: "early", title: "Earlier", order: 1 }),
      ]
    );
    const rendered = screen.getAllByText(/Earlier|Later/).map((n) => n.textContent);
    expect(rendered).toEqual(["Earlier", "Later"]);
  });
});

describe("row detail", () => {
  it("shows the goal chip", () => {
    renderList([makeTask({ title: "Write report", goalId: "g1" })]);
    expect(within(row("Write report")).getByText("deep-work")).toBeInTheDocument();
  });

  it("flags a blocked task with its reason", () => {
    renderList([makeTask({ title: "Ship it", blocked: "waiting on legal" })]);
    expect(screen.getByText(/waiting on legal/)).toBeInTheDocument();
  });

  it("counts dependencies", () => {
    renderList(
      [
        makeTask({ id: "a", title: "First" }),
        makeTask({ id: "b", title: "Second", dependsOn: ["a"] }),
      ]
    );
    expect(within(row("Second")).getByTitle("has dependencies")).toHaveTextContent("1");
  });
});

describe("row actions", () => {
  it("marks a task done from the row button", async () => {
    const user = userEvent.setup();
    renderList([makeTask({ id: "a", title: "Write report" })]);
    await user.click(within(row("Write report")).getByRole("button", { name: /done/i }));
    expect(app().plan.tasks[0].done).toBe(true);
  });

  it("reopens a finished task", async () => {
    const user = userEvent.setup();
    renderList([makeTask({ id: "a", title: "Write report", done: true })]);
    await user.click(within(row("Write report")).getByRole("button", { name: /reopen/i }));
    expect(app().plan.tasks[0].done).toBe(false);
  });

  it("exposes the circle as a checkbox naming its task", async () => {
    const user = userEvent.setup();
    renderList([makeTask({ id: "a", title: "Write report" })]);
    const box = screen.getByRole("checkbox", { name: "Write report" });
    expect(box).toHaveAttribute("aria-checked", "false");
    await user.click(box);
    expect(app().plan.tasks[0].done).toBe(true);
    expect(screen.getByRole("checkbox", { name: "Write report" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("selects a task on click and opens the editor on double click", async () => {
    const user = userEvent.setup();
    renderList([makeTask({ id: "a", title: "Write report" })]);
    await user.click(screen.getByText("Write report"));
    expect(app().selectedId).toBe("a");
    await user.dblClick(screen.getByText("Write report"));
    expect(app().editorOpen).toBe(true);
  });
});

describe("clearing finished work", () => {
  const withDone = () =>
    [
      makeTask({ id: "a", title: "Still going" }),
      makeTask({ id: "b", title: "Finished thing", done: true }),
    ];

  it("offers a clear control only when something is finished", () => {
    renderList([makeTask({ title: "Still going" })]);
    expect(screen.queryByTitle(/drop the finished tasks/)).not.toBeInTheDocument();
  });

  it("clears the day's finished tasks", async () => {
    const user = userEvent.setup();
    renderList(withDone());
    await user.click(screen.getByTitle(/drop the finished tasks/));
    expect(app().plan.tasks.map((t) => t.title)).toEqual([
      "Still going",
    ]);
  });

  it("leaves an undo offer behind", async () => {
    const user = userEvent.setup();
    renderList(withDone());
    await user.click(screen.getByTitle(/drop the finished tasks/));
    expect(app().lastCleared?.tasks).toHaveLength(1);
  });
});
