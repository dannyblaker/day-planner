import CurrentTask from "@/components/CurrentTask";
import DoneButton from "@/components/DoneButton";
import Editor from "@/components/Editor";
import GoalsPanel from "@/components/GoalsPanel";
import HelpOverlay from "@/components/HelpOverlay";
import QuickAdd from "@/components/QuickAdd";
import ThemeToggle from "@/components/ThemeToggle";
import { currentTheme } from "@/lib/theme";
import { DayPlan } from "@/lib/types";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, seedStore } from "../app-state";
import { at, makeDay, makeTask, resetFactory } from "../factory";

const tasksToday = () => app().plan.days["2026-07-28"].tasks;

beforeEach(() => {
  resetFactory();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 6, 28, 9, 0, 0));
});

describe("ThemeToggle", () => {
  it("flips the theme on click", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    expect(currentTheme()).toBe("dark");
    await user.click(screen.getByRole("button", { name: /toggle light or dark/i }));
    expect(currentTheme()).toBe("light");
    await user.click(screen.getByRole("button", { name: /toggle light or dark/i }));
    expect(currentTheme()).toBe("dark");
  });

  it("renders both glyphs, leaving the choice of which shows to CSS", () => {
    render(<ThemeToggle />);
    // server and client render the same markup — that's what avoids the flash
    expect(document.querySelector(".theme-when-dark")).toBeInTheDocument();
    expect(document.querySelector(".theme-when-light")).toBeInTheDocument();
  });

  it("mentions the keyboard shortcut only where one exists", () => {
    const { unmount } = render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /toggle/i })).toHaveAttribute(
      "title",
      expect.stringContaining("(m)")
    );
    unmount();
    render(<ThemeToggle hint={false} />);
    expect(screen.getByRole("button", { name: /toggle/i }).title).not.toContain("(m)");
  });
});

describe("DoneButton", () => {
  it("labels itself by what it will do", () => {
    const { rerender } = render(<DoneButton done={false} onToggle={() => {}} />);
    expect(screen.getByLabelText("Mark task done")).toHaveTextContent("✓");
    rerender(<DoneButton done onToggle={() => {}} />);
    expect(screen.getByLabelText("Reopen task")).toHaveTextContent("↺");
  });

  it("keeps its click away from the card underneath", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onCardClick = vi.fn();
    const onCardPointerDown = vi.fn();
    render(
      <div onClick={onCardClick} onPointerDown={onCardPointerDown}>
        <DoneButton done={false} onToggle={onToggle} />
      </div>
    );
    await user.click(screen.getByLabelText("Mark task done"));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(onCardClick).not.toHaveBeenCalled();
    expect(onCardPointerDown).not.toHaveBeenCalled();
  });
});

describe("QuickAdd", () => {
  beforeEach(() => seedStore());

  it("adds a parsed task on Enter and clears the field for the next one", async () => {
    const user = userEvent.setup();
    render(<QuickAdd />);
    const input = screen.getByPlaceholderText(/Add task/);
    await user.type(input, "Write report 45m !1{Enter}");
    expect(tasksToday()[0]).toMatchObject({
      title: "Write report",
      duration: 45,
      priority: 1,
    });
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("ignores an empty submission", async () => {
    const user = userEvent.setup();
    render(<QuickAdd />);
    await user.type(screen.getByPlaceholderText(/Add task/), "   {Enter}");
    expect(tasksToday()).toHaveLength(0);
  });
});

describe("CurrentTask", () => {
  const renderPanel = (day: DayPlan) => {
    seedStore(day);
    return render(<CurrentTask />);
  };

  it("offers the next task when nothing is running", () => {
    renderPanel(makeDay([makeTask({ id: "a", title: "Write report" })]));
    expect(screen.getByText("Up next")).toBeInTheDocument();
    expect(screen.getByText("Write report")).toBeInTheDocument();
  });

  it("starts the offered task", async () => {
    const user = userEvent.setup();
    renderPanel(makeDay([makeTask({ id: "a", title: "Write report" })]));
    await user.click(screen.getByRole("button", { name: /start/i }));
    expect(tasksToday()[0].status).toBe("active");
  });

  it("says so when there is nothing queued", () => {
    renderPanel(makeDay([]));
    expect(screen.getByText(/All clear/)).toBeInTheDocument();
  });

  it("counts down while a task runs", () => {
    renderPanel(
      makeDay([
        makeTask({ title: "Write report", duration: 30, status: "active", actualStart: at(8, 50) }),
      ])
    );
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText(/−20:00/)).toBeInTheDocument();
  });

  it("switches to overrun once the planned time is gone", () => {
    renderPanel(
      makeDay([
        makeTask({ title: "Write report", duration: 30, status: "active", actualStart: at(8) }),
      ])
    );
    expect(screen.getByText("Overrunning")).toBeInTheDocument();
    expect(screen.getByText(/\+30:00/)).toBeInTheDocument();
  });

  it("pauses and completes from the panel", async () => {
    const user = userEvent.setup();
    renderPanel(
      makeDay([
        makeTask({ id: "a", title: "Write report", status: "active", actualStart: at(8, 50) }),
      ])
    );
    await user.click(screen.getByRole("button", { name: /pause/i }));
    expect(tasksToday()[0].status).toBe("todo");
  });

  it("puts the countdown in the tab title", () => {
    renderPanel(
      makeDay([
        makeTask({ title: "Write report", duration: 30, status: "active", actualStart: at(8, 50) }),
      ])
    );
    expect(document.title).toContain("Write report");
  });
});

describe("Editor", () => {
  const openEditorOn = (day: DayPlan, id: string) => {
    seedStore(day);
    app().select(id);
    app().setEditorOpen(true);
    return render(<Editor />);
  };

  it("stays closed until a task is selected and opened", () => {
    seedStore(makeDay([makeTask({ id: "a" })]));
    render(<Editor />);
    expect(screen.queryByText("Edit task")).not.toBeInTheDocument();
  });

  it("edits the title and duration", async () => {
    const user = userEvent.setup();
    openEditorOn(makeDay([makeTask({ id: "a", title: "Old" })]), "a");
    const title = screen.getByDisplayValue("Old");
    await user.clear(title);
    await user.type(title, "New");
    expect(tasksToday()[0].title).toBe("New");
  });

  it("sets priority from the P buttons", async () => {
    const user = userEvent.setup();
    openEditorOn(makeDay([makeTask({ id: "a" })]), "a");
    await user.click(screen.getByRole("button", { name: "P1" }));
    expect(tasksToday()[0].priority).toBe(1);
  });

  it("assigns a goal", async () => {
    const user = userEvent.setup();
    openEditorOn(makeDay([makeTask({ id: "a" })]), "a");
    await user.selectOptions(screen.getByRole("combobox"), "g1");
    expect(tasksToday()[0].goalId).toBe("g1");
  });

  it("marks a task parallel", async () => {
    const user = userEvent.setup();
    openEditorOn(makeDay([makeTask({ id: "a" })]), "a");
    await user.click(screen.getByLabelText(/runs in parallel/));
    expect(tasksToday()[0].parallel).toBe(true);
  });

  it("blocks a task by typing a reason", async () => {
    const user = userEvent.setup();
    openEditorOn(makeDay([makeTask({ id: "a" })]), "a");
    await user.type(screen.getByPlaceholderText(/reason/), "waiting");
    expect(tasksToday()[0].blocked).toBe("waiting");
  });

  it("links a dependency, and refuses one that would cycle", async () => {
    const user = userEvent.setup();
    openEditorOn(
      makeDay([
        makeTask({ id: "a", title: "First" }),
        makeTask({ id: "b", title: "Second" }),
      ]),
      "a"
    );
    await user.click(screen.getByLabelText("Second"));
    expect(tasksToday()[0].dependsOn).toEqual(["b"]);

    // now edit Second: depending on First would close the loop
    app().select("b");
    expect(await screen.findByTitle(/would create a dependency cycle/)).toBeInTheDocument();
    expect(screen.getByLabelText("First")).toBeDisabled();
  });

  it("defers and deletes", async () => {
    const user = userEvent.setup();
    openEditorOn(makeDay([makeTask({ id: "a", title: "Only" })]), "a");
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(tasksToday()).toHaveLength(0);
  });

  describe("move to another day", () => {
    const picker = () => screen.getByLabelText("Move to another day");
    const moveButton = () => screen.getByRole("button", { name: "move →" });

    it("aims at today, so there is nothing to do while today is on screen", () => {
      openEditorOn(makeDay([makeTask({ id: "a", title: "Only" })]), "a");
      expect(picker()).toHaveValue("2026-07-28");
      expect(moveButton()).toBeDisabled();
    });

    it("sends the task to the day the picker names", async () => {
      const user = userEvent.setup();
      openEditorOn(makeDay([makeTask({ id: "a", title: "Only" })]), "a");
      fireEvent.change(picker(), { target: { value: "2026-08-05" } });
      await user.click(moveButton());
      expect(tasksToday()).toHaveLength(0);
      expect(app().plan.days["2026-08-05"].tasks[0].title).toBe("Only");
    });

    it("offers a week out as a shortcut", async () => {
      const user = userEvent.setup();
      openEditorOn(makeDay([makeTask({ id: "a", title: "Only" })]), "a");
      await user.click(screen.getByRole("button", { name: "+1 week" }));
      await user.click(moveButton());
      expect(app().plan.days["2026-08-04"].tasks[0].title).toBe("Only");
    });

  });
});

describe("GoalsPanel", () => {
  it("shows time done against time planned per goal", () => {
    seedStore(
      makeDay([
        makeTask({ goalId: "g1", duration: 60, status: "done", actualMinutes: 45 }),
        makeTask({ goalId: "g1", duration: 30 }),
      ])
    );
    render(<GoalsPanel />);
    expect(screen.getByText("deep-work")).toBeInTheDocument();
    expect(screen.getByText("45m / 1h 30m")).toBeInTheDocument();
  });

  it("counts tasks with no goal", () => {
    seedStore(makeDay([makeTask({}), makeTask({})]));
    render(<GoalsPanel />);
    expect(screen.getByText(/2 tasks not mapped to a goal/)).toBeInTheDocument();
  });

  it("adds a goal on Enter", async () => {
    const user = userEvent.setup();
    seedStore();
    render(<GoalsPanel />);
    await user.type(screen.getByPlaceholderText("+ new goal"), "reading{Enter}");
    expect(app().plan.goals.map((g) => g.name)).toContain("reading");
  });

  it("deletes a goal", async () => {
    const user = userEvent.setup();
    seedStore();
    render(<GoalsPanel />);
    await user.click(screen.getByTitle("delete goal"));
    expect(app().plan.goals).toHaveLength(0);
  });
});

describe("HelpOverlay", () => {
  it("shows only when asked", async () => {
    const user = userEvent.setup();
    seedStore();
    render(<HelpOverlay />);
    expect(screen.queryByText("Keyboard shortcuts")).not.toBeInTheDocument();

    app().setHelpOpen(true);
    expect(await screen.findByText("Keyboard shortcuts")).toBeInTheDocument();
    await user.click(screen.getByText("✕"));
    expect(app().helpOpen).toBe(false);
  });

  it("documents the shortcuts the app actually listens for", () => {
    seedStore();
    app().setHelpOpen(true);
    render(<HelpOverlay />);
    for (const key of ["d", "b", "m", "Shift+O", "u / ⌘Z", "?"]) {
      expect(screen.getByText(key, { selector: "kbd" })).toBeInTheDocument();
    }
  });
});
