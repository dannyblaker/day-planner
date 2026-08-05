import { expect, flowNode, quickAdd, row, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Concurrent Crocodiles" })).toBeVisible();
});

test.describe("the morning brain-dump", () => {
  test("adds tasks to the list and the canvas at once", async ({ page, planServer }) => {
    await quickAdd(page, "Draft the proposal 1h !1 #deep-work", "Draft the proposal");
    await quickAdd(page, "Review PRs 45m !2", "Review PRs");

    await expect(page.getByText("In progress · 2")).toBeVisible();
    await expect(flowNode(page, "Draft the proposal")).toBeVisible();
    await expect(flowNode(page, "Draft the proposal").getByText("1h")).toBeVisible();
    await expect(row(page, "Draft the proposal").getByText("deep-work")).toBeVisible();

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

  test("links a dependent task to its prerequisite", async ({ page }) => {
    await quickAdd(page, "Design it 1h", "Design it");
    await quickAdd(page, "Build it 30m >design", "Build it");

    await expect(row(page, "Build it").getByTitle("has dependencies")).toHaveText(/1/);
    // an arrow on the canvas, drawn from the prerequisite to the dependent
    await expect(page.locator("g.cursor-pointer")).toHaveCount(1);
    await expect(page.locator("svg title")).toContainText("Design it");
  });

  test("holds a blocked task at to-do, flagged on the canvas", async ({ page }) => {
    await quickAdd(page, "Ship it 20m *waiting-on-legal", "Ship it");
    await expect(page.getByText("To do · 1")).toBeVisible();
    await expect(page.getByText(/waiting on legal/).first()).toBeVisible();
    await expect(flowNode(page, "Ship it").getByText(/waiting on legal/)).toBeVisible();
  });

  test("marks background work concurrent on the one canvas", async ({ page }) => {
    await quickAdd(page, "Focus work 1h", "Focus work");
    await quickAdd(page, "CI pipeline 45m ~", "CI pipeline");

    await expect(flowNode(page, "CI pipeline").getByTitle("concurrent")).toBeVisible();
    await expect(flowNode(page, "Focus work").getByTitle("concurrent")).toHaveCount(0);
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
    expect(planServer.tasks()[0].done).toBe(true);
  });

  test("from the flowchart node, and back again", async ({ page, planServer }) => {
    await page.locator("body").click();
    const node = flowNode(page, "Write the report");
    await node.hover();
    await node.getByLabel("Mark task done").click();
    await expect(page.getByText("Done · 1")).toBeVisible();

    await node.hover();
    await node.getByLabel("Reopen task").click();
    await expect(page.getByText("In progress · 1")).toBeVisible();
    await planServer.settled();
    expect(planServer.tasks()[0].done).toBe(false);
  });

  test("with the d key", async ({ page }) => {
    await page.locator("body").click();
    await page.keyboard.press("j");
    await page.keyboard.press("d");
    await expect(page.getByText("Done · 1")).toBeVisible();
    await page.keyboard.press("d");
    await expect(page.getByText("In progress · 1")).toBeVisible();
  });
});

test.describe("the flowchart", () => {
  test("drags a node without tripping its done button", async ({ page, planServer }) => {
    await quickAdd(page, "Write the report 30m", "Write the report");
    await page.locator("body").click();

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
    expect(planServer.tasks()[0].done).toBe(false);
  });

  test("draws and removes a dependency arrow", async ({ page, planServer }) => {
    await quickAdd(page, "First job 30m", "First job");
    await quickAdd(page, "Second job 30m", "Second job");
    await page.locator("body").click();

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

  test("drags an arrow into empty space and names the task on the end of it", async ({
    page,
    planServer,
  }) => {
    await quickAdd(page, "First job 30m", "First job");
    await page.locator("body").click();

    const source = flowNode(page, "First job");
    const port = source.locator("div[title^='drag to another task']");
    const portBox = (await port.boundingBox())!;

    await page.mouse.move(portBox.x + portBox.width / 2, portBox.y + portBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(portBox.x + 300, portBox.y + 160, { steps: 10 });
    await page.mouse.up();

    // nothing exists yet — the arrow is waiting on a title
    await page.getByPlaceholder(/New task/).fill("Second job 20m");
    await page.getByPlaceholder(/New task/).press("Enter");

    await expect(flowNode(page, "Second job")).toBeVisible();
    await planServer.settled();
    const first = planServer.tasks().find((t) => t.title === "First job")!;
    const second = planServer.tasks().find((t) => t.title === "Second job")!;
    expect(second.dependsOn).toEqual([first.id]);
    // dropped where it was let go, not back in a column
    expect(Number(second.flowX)).toBeGreaterThan(Number(first.flowX));
  });

  test("creates a dependent task from the keyboard with a", async ({ page, planServer }) => {
    await quickAdd(page, "First job 30m", "First job");
    await page.locator("body").click();
    await page.keyboard.press("j");
    await page.keyboard.press("a");

    await page.getByPlaceholder(/New task/).fill("Second job 20m");
    await page.getByPlaceholder(/New task/).press("Enter");

    // the new task is selected, so a again chains a third off the second
    await page.keyboard.press("a");
    await page.getByPlaceholder(/New task/).fill("Third job 20m");
    await page.getByPlaceholder(/New task/).press("Enter");

    await planServer.settled();
    const id = (title: string) => planServer.tasks().find((t) => t.title === title)!.id;
    expect(planServer.tasks().find((t) => t.title === "Second job")!.dependsOn).toEqual([
      id("First job"),
    ]);
    expect(planServer.tasks().find((t) => t.title === "Third job")!.dependsOn).toEqual([
      id("Second job"),
    ]);
  });

  test("opens the editor beside the canvas, not off-screen", async ({ page }) => {
    await quickAdd(page, "Write the report 30m", "Write the report");
    await page.locator("body").click();

    await flowNode(page, "Write the report").dblclick();
    const editor = page.getByRole("complementary").filter({ hasText: "Edit task" });
    await expect(editor).toBeInViewport();
    await expect(editor.getByRole("textbox").first()).toHaveValue("Write the report");
  });

  test("creates a task by double-clicking the canvas", async ({ page, planServer }) => {
    await page.locator(".cursor-grab").first().dblclick({ position: { x: 400, y: 300 } });
    await page.getByPlaceholder(/New task/).fill("Made on the canvas 25m");
    await page.getByPlaceholder(/New task/).press("Enter");

    await expect(flowNode(page, "Made on the canvas")).toBeVisible();
    await planServer.settled();
    expect(planServer.titles()).toContain("Made on the canvas");
  });
});
