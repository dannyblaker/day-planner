import FlowView from "@/components/FlowView";
import { Task } from "@/lib/types";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, seedStore } from "../app-state";
import { makeTask, resetFactory } from "../factory";

function renderFlow(tasks: Task[]) {
  seedStore(tasks);
  return render(<FlowView />);
}

const planTasks = () => app().plan.tasks;
const node = (title: string) =>
  screen.getByText(title).closest("[data-flow-node]") as HTMLElement;

beforeEach(() => {
  resetFactory();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 6, 28, 9, 0, 0));
});

describe("the canvas", () => {
  it("draws a node per task, with its duration", () => {
    renderFlow(
      [
        makeTask({ id: "a", title: "Write report", duration: 60 }),
        makeTask({ id: "b", title: "Review PRs", duration: 30 }),
      ]
    );
    expect(screen.getAllByText(/Write report|Review PRs/)).toHaveLength(2);
    expect(within(node("Write report")).getByText("1h")).toBeInTheDocument();
  });

  it("draws a single canvas, with no band divider", () => {
    renderFlow([makeTask({ title: "Anything" })]);
    expect(screen.queryByText(/focus — one at a time/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/parallel \/ background/i)).not.toBeInTheDocument();
  });

  it("gives every node a position on first render", () => {
    renderFlow([makeTask({ id: "a" }), makeTask({ id: "b" })]);
    expect(planTasks().every((t) => t.flowX != null && t.flowY != null)).toBe(true);
  });

  it("draws an arrow per dependency", () => {
    const { container } = renderFlow(
      [
        makeTask({ id: "a", title: "First" }),
        makeTask({ id: "b", title: "Second", dependsOn: ["a"] }),
      ]
    );
    expect(container.querySelectorAll("g[class*='cursor-pointer']")).toHaveLength(1);
    expect(screen.getByText(/First → Second/)).toBeInTheDocument();
  });

  it("marks blocked work on the node", () => {
    renderFlow(
      [makeTask({ title: "Ship it", blocked: "waiting on legal", duration: 30 })]
    );
    expect(screen.getByText(/waiting on legal/)).toBeInTheDocument();
  });

  it("shows a concurrency mark on parallel tasks", () => {
    renderFlow([makeTask({ title: "CI run", parallel: true })]);
    expect(screen.getByTitle("concurrent")).toBeInTheDocument();
  });
});

describe("interaction", () => {
  it("selects on click and opens the editor on double click", async () => {
    const user = userEvent.setup();
    renderFlow([makeTask({ id: "a", title: "Write report" })]);
    await user.click(node("Write report"));
    expect(app().selectedId).toBe("a");
    await user.dblClick(node("Write report"));
    expect(app().editorOpen).toBe(true);
  });

  it("marks a task done from its node", async () => {
    const user = userEvent.setup();
    renderFlow([makeTask({ id: "a", title: "Write report" })]);
    await user.click(within(node("Write report")).getByLabelText("Mark task done"));
    expect(planTasks()[0].done).toBe(true);
    expect(app().selectedId).toBeNull(); // the click didn't fall through to the node
  });

  it("reopens a finished task from its node", async () => {
    const user = userEvent.setup();
    renderFlow([makeTask({ id: "a", title: "Write report", done: true })]);
    await user.click(within(node("Write report")).getByLabelText("Reopen task"));
    expect(planTasks()[0].done).toBe(false);
  });

  it("removes a dependency when its arrow is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderFlow(
      [
        makeTask({ id: "a", title: "First" }),
        makeTask({ id: "b", title: "Second", dependsOn: ["a"] }),
      ]
    );
    // the visible arrow is unclickable by design; the fat transparent path
    // beneath it is the hit target, and the click bubbles up to the group
    await user.click(container.querySelector('path[stroke="transparent"]')!);
    expect(planTasks().find((t) => t.id === "b")!.dependsOn).toEqual([]);
  });

  it("re-lays the graph on auto-arrange", async () => {
    const user = userEvent.setup();
    renderFlow(
      [
        makeTask({ id: "a", title: "First", flowX: 900, flowY: 900 }),
        makeTask({ id: "b", title: "Second", dependsOn: ["a"], flowX: 10, flowY: 10 }),
      ]
    );
    await user.click(screen.getByRole("button", { name: /auto-arrange/i }));
    const [a, b] = planTasks();
    expect(a.flowX).toBe(40);
    expect(b.flowX!).toBeGreaterThan(a.flowX!);
  });
});

/**
 * The arrow and the task on the end of it are the same gesture: every way of
 * starting one asks for a title, and wires the dependency when you give it.
 * (Dragging is only meaningful with real geometry — that half lives in e2e.)
 */
describe("growing the graph forwards", () => {
  const port = (title: string) =>
    within(node(title)).getByTitle(/drag to another task/);
  const createInput = () => screen.getByPlaceholderText(/New task/);

  it("asks for a new task when the port is clicked", async () => {
    const user = userEvent.setup();
    renderFlow([makeTask({ id: "a", title: "First", flowX: 40, flowY: 60 })]);

    await user.click(port("First"));
    expect(createInput()).toHaveAttribute(
      "placeholder",
      expect.stringContaining("First")
    );

    await user.type(createInput(), "Second job 45m{Enter}");
    const created = planTasks().find((t) => t.title === "Second job")!;
    expect(created.dependsOn).toEqual(["a"]);
    expect(created.duration).toBe(45);
  });

  it("puts the new task to the right of the one it waits on", async () => {
    const user = userEvent.setup();
    renderFlow([makeTask({ id: "a", title: "First", flowX: 300, flowY: 200 })]);

    await user.click(port("First"));
    await user.type(createInput(), "Second job{Enter}");
    const created = planTasks().find((t) => t.title === "Second job")!;
    expect(created.flowX!).toBeGreaterThan(300);
    expect(created.flowY).toBe(200);
  });

  it("creates nothing if the input is dismissed", async () => {
    const user = userEvent.setup();
    renderFlow([makeTask({ id: "a", title: "First" })]);

    await user.click(port("First"));
    await user.type(createInput(), "Never mind{Escape}");
    expect(planTasks()).toHaveLength(1);
  });

  it("opens the same input for the selected task on request", async () => {
    const user = userEvent.setup();
    renderFlow([
      makeTask({ id: "a", title: "First" }),
      makeTask({ id: "b", title: "Other" }),
    ]);

    act(() => app().requestNewTaskFrom("b"));
    await user.type(createInput(), "Follow-up{Enter}");
    expect(planTasks().find((t) => t.title === "Follow-up")!.dependsOn).toEqual([
      "b",
    ]);
  });

  it("reopens on a second request for the same task", async () => {
    const user = userEvent.setup();
    renderFlow([makeTask({ id: "a", title: "First" })]);

    act(() => app().requestNewTaskFrom("a"));
    await user.type(createInput(), "One{Enter}");
    act(() => app().requestNewTaskFrom("a"));
    await user.type(createInput(), "Two{Enter}");

    expect(planTasks().map((t) => t.title)).toEqual(["First", "One", "Two"]);
  });
});
