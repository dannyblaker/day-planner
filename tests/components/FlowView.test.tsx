import FlowView from "@/components/FlowView";
import { DayPlan } from "@/lib/types";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, seedStore } from "../app-state";
import { makeDay, makeTask, resetFactory } from "../factory";

function renderFlow(day: DayPlan) {
  seedStore(day);
  return render(<FlowView />);
}

const tasksToday = () => app().plan.days["2026-07-28"].tasks;
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
      makeDay([
        makeTask({ id: "a", title: "Write report", duration: 60 }),
        makeTask({ id: "b", title: "Review PRs", duration: 30 }),
      ])
    );
    expect(screen.getAllByText(/Write report|Review PRs/)).toHaveLength(2);
    expect(within(node("Write report")).getByText("1h")).toBeInTheDocument();
  });

  it("labels both bands", () => {
    renderFlow(makeDay([makeTask({ title: "Anything" })]));
    expect(screen.getByText(/focus — one at a time/i)).toBeInTheDocument();
    expect(screen.getByText(/parallel \/ background/i)).toBeInTheDocument();
  });

  it("gives every node a position on first render", () => {
    renderFlow(makeDay([makeTask({ id: "a" }), makeTask({ id: "b" })]));
    expect(tasksToday().every((t) => t.flowX != null && t.flowY != null)).toBe(true);
  });

  it("draws an arrow per dependency", () => {
    const { container } = renderFlow(
      makeDay([
        makeTask({ id: "a", title: "First" }),
        makeTask({ id: "b", title: "Second", dependsOn: ["a"] }),
      ])
    );
    expect(container.querySelectorAll("g[class*='cursor-pointer']")).toHaveLength(1);
    expect(screen.getByText(/First → Second/)).toBeInTheDocument();
  });

  it("marks blocked work on the node", () => {
    renderFlow(
      makeDay([makeTask({ title: "Ship it", blocked: "waiting on legal", duration: 30 })])
    );
    expect(screen.getByText(/waiting on legal/)).toBeInTheDocument();
  });

  it("shows a concurrency mark on parallel tasks", () => {
    renderFlow(makeDay([makeTask({ title: "CI run", parallel: true })]));
    expect(screen.getByTitle("concurrent")).toBeInTheDocument();
  });
});

describe("interaction", () => {
  it("selects on click and opens the editor on double click", async () => {
    const user = userEvent.setup();
    renderFlow(makeDay([makeTask({ id: "a", title: "Write report" })]));
    await user.click(node("Write report"));
    expect(app().selectedId).toBe("a");
    await user.dblClick(node("Write report"));
    expect(app().editorOpen).toBe(true);
  });

  it("marks a task done from its node", async () => {
    const user = userEvent.setup();
    renderFlow(makeDay([makeTask({ id: "a", title: "Write report" })]));
    await user.click(within(node("Write report")).getByLabelText("Mark task done"));
    expect(tasksToday()[0].status).toBe("done");
    expect(app().selectedId).toBeNull(); // the click didn't fall through to the node
  });

  it("reopens a finished task from its node", async () => {
    const user = userEvent.setup();
    renderFlow(makeDay([makeTask({ id: "a", title: "Write report", status: "done" })]));
    await user.click(within(node("Write report")).getByLabelText("Reopen task"));
    expect(tasksToday()[0].status).toBe("todo");
  });

  it("removes a dependency when its arrow is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderFlow(
      makeDay([
        makeTask({ id: "a", title: "First" }),
        makeTask({ id: "b", title: "Second", dependsOn: ["a"] }),
      ])
    );
    // the visible arrow is unclickable by design; the fat transparent path
    // beneath it is the hit target, and the click bubbles up to the group
    await user.click(container.querySelector('path[stroke="transparent"]')!);
    expect(tasksToday().find((t) => t.id === "b")!.dependsOn).toEqual([]);
  });

  it("re-lays the graph on auto-arrange", async () => {
    const user = userEvent.setup();
    renderFlow(
      makeDay([
        makeTask({ id: "a", title: "First", flowX: 900, flowY: 900 }),
        makeTask({ id: "b", title: "Second", dependsOn: ["a"], flowX: 10, flowY: 10 }),
      ])
    );
    await user.click(screen.getByRole("button", { name: /auto-arrange/i }));
    const [a, b] = tasksToday();
    expect(a.flowX).toBe(40);
    expect(b.flowX!).toBeGreaterThan(a.flowX!);
  });
});
