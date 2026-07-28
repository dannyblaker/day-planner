import { expect, flowNode, quickAdd, row, slot, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DayFlow" })).toBeVisible();
});

test.describe("the morning brain-dump", () => {
  test("adds tasks and schedules them back to back", async ({ page, planServer }) => {
    await quickAdd(page, "Draft the proposal 1h !1 #deep-work", "Draft the proposal");
    await quickAdd(page, "Review PRs 45m !2", "Review PRs");

    await expect(page.getByText("Queue · 2")).toBeVisible();
    await expect(slot(page, "Draft the proposal")).toBeVisible();
    await expect(row(page, "Draft the proposal").getByText("deep-work")).toBeVisible();

    // the second task starts where the first one ends
    await expect(slot(page, "Draft the proposal")).toHaveAttribute("title", /08:00–09:00/);
    await expect(slot(page, "Review PRs")).toHaveAttribute("title", /09:00–09:45/);

    await planServer.settled();
    expect(planServer.titles()).toEqual(["Draft the proposal", "Review PRs"]);
  });

  test("writes nothing back just for opening the app", async ({ page, planServer }) => {
    await page.waitForTimeout(1200); // well past the 600ms autosave debounce
    expect(planServer.saveCount()).toBe(0);
  });

  test("keeps the input focused so tasks can be typed in a row", async ({ page }) => {
    const input = page.getByPlaceholder(/Add task/);
    await input.fill("First task");
    await input.press("Enter");
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
  });

  test("pins a meeting at its time and packs work around it", async ({ page }) => {
    await quickAdd(page, "Standup 15m @10:00", "Standup");
    await quickAdd(page, "Deep work 3h", "Deep work");

    await expect(slot(page, "Standup")).toHaveAttribute("title", /10:00–10:15/);
    // three hours cannot fit before 10:00, so it lands after the meeting
    await expect(slot(page, "Deep work")).toHaveAttribute("title", /10:15–13:15/);
  });

  test("puts an urgent task at the front of the queue", async ({ page, planServer }) => {
    await quickAdd(page, "Normal work 30m", "Normal work");
    await quickAdd(page, "Hotfix 20m ^", "Hotfix");
    await planServer.settled();

    const order = planServer
      .tasks()
      .sort((a, b) => a.order - b.order)
      .map((t) => t.title);
    expect(order).toEqual(["Hotfix", "Normal work"]);
  });

  test("holds a dependent task until its prerequisite is done", async ({ page }) => {
    await quickAdd(page, "Design it 1h", "Design it");
    await quickAdd(page, "Build it 30m >design", "Build it");

    await expect(slot(page, "Design it")).toHaveAttribute("title", /08:00–09:00/);
    await expect(slot(page, "Build it")).toHaveAttribute("title", /09:00–09:30/);
    await expect(row(page, "Build it").getByTitle("has dependencies")).toHaveText(/1/);
  });

  test("parks a blocked task out of the timeline", async ({ page }) => {
    await quickAdd(page, "Ship it 20m *waiting-on-legal", "Ship it");
    await expect(page.getByText("Blocked · 1")).toBeVisible();
    await expect(page.getByText(/waiting on legal/)).toBeVisible();
    await expect(slot(page, "Ship it")).toHaveCount(0);
  });

  test("gives background work its own lane", async ({ page }) => {
    await quickAdd(page, "Focus work 1h", "Focus work");
    await quickAdd(page, "CI pipeline 45m ~", "CI pipeline");
    await expect(page.getByText("parallel")).toBeVisible();
    // both start at once — the background lane overlaps focus work
    await expect(slot(page, "Focus work")).toHaveAttribute("title", /08:00–09:00/);
    await expect(slot(page, "CI pipeline")).toHaveAttribute("title", /08:00–08:45/);
  });
});

test.describe("capacity", () => {
  test("reports slack, then flags going over", async ({ page }) => {
    await expect(page.getByTitle(/focus-lane work remaining/)).toContainText("slack");
    await quickAdd(page, "Enormous job 12h", "Enormous job");
    await expect(page.getByTitle(/focus-lane work remaining/)).toContainText("over by");
    await expect(slot(page, "Enormous job").getByText("past day end")).toBeVisible();
  });
});

test.describe("marking work done", () => {
  test.beforeEach(async ({ page }) => {
    await quickAdd(page, "Write the report 30m", "Write the report");
  });

  test("from the sidebar row", async ({ page, planServer }) => {
    await row(page, "Write the report").hover();
    await row(page, "Write the report").getByRole("button", { name: /done/i }).click();
    await expect(page.getByText("Done · 1")).toBeVisible();
    await planServer.settled();
    expect(planServer.tasks()[0].status).toBe("done");
  });

  test("from the timeline block", async ({ page, planServer }) => {
    await slot(page, "Write the report").hover();
    await slot(page, "Write the report").getByLabel("Mark task done").click();
    await expect(page.getByText("Done · 1")).toBeVisible();
    await planServer.settled();
    expect(planServer.tasks()[0].status).toBe("done");
  });

  test("from the flowchart node, and back again", async ({ page, planServer }) => {
    await page.locator("body").click();
    await page.keyboard.press("v");
    const node = flowNode(page, "Write the report");
    await node.hover();
    await node.getByLabel("Mark task done").click();
    await expect(page.getByText("Done · 1")).toBeVisible();

    await node.hover();
    await node.getByLabel("Reopen task").click();
    await expect(page.getByText("Queue · 1")).toBeVisible();
    await planServer.settled();
    expect(planServer.tasks()[0].status).toBe("todo");
  });

  test("with the d key", async ({ page }) => {
    await page.locator("body").click();
    await page.keyboard.press("j");
    await page.keyboard.press("d");
    await expect(page.getByText("Done · 1")).toBeVisible();
    await page.keyboard.press("d");
    await expect(page.getByText("Queue · 1")).toBeVisible();
  });
});

test.describe("the flowchart", () => {
  test("drags a node without tripping its done button", async ({ page, planServer }) => {
    await quickAdd(page, "Write the report 30m", "Write the report");
    await page.locator("body").click();
    await page.keyboard.press("v");

    const node = flowNode(page, "Write the report");
    const before = (await node.boundingBox())!;
    await page.mouse.move(before.x + 60, before.y + 20);
    await page.mouse.down();
    await page.mouse.move(before.x + 260, before.y + 120, { steps: 10 });
    await page.mouse.up();

    const after = (await node.boundingBox())!;
    expect(Math.round(after.x - before.x)).toBe(200);
    expect(Math.round(after.y - before.y)).toBe(100);
    await planServer.settled();
    expect(planServer.tasks()[0].status).toBe("todo");
  });

  test("draws and removes a dependency arrow", async ({ page, planServer }) => {
    await quickAdd(page, "First job 30m", "First job");
    await quickAdd(page, "Second job 30m", "Second job");
    await page.locator("body").click();
    await page.keyboard.press("v");

    const source = flowNode(page, "First job");
    const target = flowNode(page, "Second job");
    const port = source.locator("div[title^='drag to another task']");
    const portBox = (await port.boundingBox())!;
    const targetBox = (await target.boundingBox())!;

    await page.mouse.move(portBox.x + portBox.width / 2, portBox.y + portBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
      steps: 10,
    });
    await page.mouse.up();

    await planServer.settled();
    const second = planServer.tasks().find((t) => t.title === "Second job")!;
    const first = planServer.tasks().find((t) => t.title === "First job")!;
    expect(second.dependsOn).toEqual([first.id]);

    // clicking the arrow removes it again
    await page.locator("path[stroke='transparent']").first().click({ force: true });
    await planServer.settled();
    expect(planServer.tasks().find((t) => t.title === "Second job")!.dependsOn).toEqual([]);
  });

  test("creates a task by double-clicking the canvas", async ({ page, planServer }) => {
    await page.keyboard.press("v");
    await page.locator(".cursor-grab").first().dblclick({ position: { x: 400, y: 300 } });
    await page.getByPlaceholder(/New task/).fill("Made on the canvas 25m");
    await page.getByPlaceholder(/New task/).press("Enter");

    await expect(flowNode(page, "Made on the canvas")).toBeVisible();
    await planServer.settled();
    expect(planServer.titles()).toContain("Made on the canvas");
  });
});

test.describe("moving between days", () => {
  test("carries a task to tomorrow and back", async ({ page, planServer }) => {
    await quickAdd(page, "Today's job 30m", "Today's job");
    await page.locator("body").click();
    await page.keyboard.press("j");
    await page.keyboard.press("o"); // defer

    await expect(page.getByText("Nothing queued")).toBeVisible();
    await page.keyboard.press("]");
    await expect(row(page, "Today's job")).toBeVisible();

    await page.keyboard.press("[");
    await expect(page.getByText("Nothing queued")).toBeVisible();
    await planServer.settled();
    expect(planServer.titles()).toEqual([]);
  });
});
