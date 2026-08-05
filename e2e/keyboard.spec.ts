import { expect, quickAdd, row, test } from "./fixtures";

const selected = (page: import("@playwright/test").Page) =>
  page.locator("[data-task-row].border-lagoon-400\\/70");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Concurrent Crocodiles" })).toBeVisible();
  await quickAdd(page, "First job", "First job");
  await quickAdd(page, "Second job", "Second job");
  await quickAdd(page, "Third job", "Third job");
  // adding a task selects it — start each test from a clean slate instead
  await page.getByRole("heading", { name: "Concurrent Crocodiles" }).click();
  await page.keyboard.press("Escape");
  await expect(selected(page)).toHaveCount(0);
});

test("moves the selection with g and f", async ({ page }) => {
  await page.keyboard.press("g");
  await expect(selected(page)).toContainText("First job");
  await page.keyboard.press("g");
  await expect(selected(page)).toContainText("Second job");
  await page.keyboard.press("f");
  await expect(selected(page)).toContainText("First job");
});

test("moves it with the arrow keys too", async ({ page }) => {
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(selected(page)).toContainText("Second job");
  await page.keyboard.press("ArrowUp");
  await expect(selected(page)).toContainText("First job");
});

/**
 * The walk follows the arrows, so `g` from a task goes to whatever waits on it
 * — across the board — rather than to the task under it in the sidebar.
 */
test("walks downstream: g goes to what waits on the focused task", async ({ page }) => {
  await quickAdd(page, "Design it", "Design it");
  await quickAdd(page, "Build it >design", "Build it");
  await page.getByRole("heading", { name: "Concurrent Crocodiles" }).click();
  await page.keyboard.press("Escape");

  // First job, Second job, Third job and Design it are all chain heads; the
  // one thing with an arrow into it is Build it, and it comes straight after
  // the task it waits on rather than at the end of the queue
  await page.keyboard.press("g");
  await expect(selected(page)).toContainText("First job");
  for (let i = 0; i < 3; i++) await page.keyboard.press("g");
  await expect(selected(page)).toContainText("Design it");
  await page.keyboard.press("g");
  await expect(selected(page)).toContainText("Build it");

  // and f comes back the way it went
  await page.keyboard.press("f");
  await expect(selected(page)).toContainText("Design it");
});

test("no longer answers to j and k, which select nothing now", async ({ page }) => {
  await page.keyboard.press("j");
  await page.keyboard.press("k");
  await expect(selected(page)).toHaveCount(0);
});

test("stops at the ends rather than wrapping", async ({ page }) => {
  await page.keyboard.press("f");
  await expect(selected(page)).toContainText("First job");
  for (let i = 0; i < 5; i++) await page.keyboard.press("g");
  await expect(selected(page)).toContainText("Third job");
});

test("reorders the queue with shift+J and shift+K", async ({ page, planServer }) => {
  await page.keyboard.press("g");
  await page.keyboard.press("J");
  await planServer.settled();

  const order = planServer
    .tasks()
    .sort((a, b) => a.order - b.order)
    .map((t) => t.title);
  expect(order).toEqual(["Second job", "First job", "Third job"]);
});

test("changes priority on the selected task", async ({ page, planServer }) => {
  await page.keyboard.press("g");
  await page.keyboard.press("1");
  await planServer.settled();

  const first = planServer.tasks().find((t) => t.title === "First job")!;
  expect(first.priority).toBe(1);
});

test("sorts the queue by priority with s", async ({ page, planServer }) => {
  await page.keyboard.press("g");
  await page.keyboard.press("g");
  await page.keyboard.press("g"); // Third job
  await page.keyboard.press("1");
  await page.keyboard.press("s");
  await planServer.settled();

  const order = planServer
    .tasks()
    .sort((a, b) => a.order - b.order)
    .map((t) => t.title);
  expect(order[0]).toBe("Third job");
});

test("blocks and unblocks with b", async ({ page }) => {
  // all three start unblocked, so all three are in progress
  await expect(page.getByText("In progress · 3")).toBeVisible();
  await page.keyboard.press("g");
  await page.keyboard.press("b");
  // a blocker holds it at to-do
  await expect(page.getByText("In progress · 2")).toBeVisible();
  await expect(page.getByText("To do · 1")).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.getByText("In progress · 3")).toBeVisible();
});

test("marks done with d, and the group counts follow", async ({ page }) => {
  await page.keyboard.press("g");
  await page.keyboard.press("d");
  await expect(page.getByText("In progress · 2")).toBeVisible();
  await expect(page.getByText("Done · 1")).toBeVisible();
  await page.keyboard.press("d");
  await expect(page.getByText("In progress · 3")).toBeVisible();
});

test("deletes with x", async ({ page }) => {
  await page.keyboard.press("g");
  await page.keyboard.press("x");
  await expect(page.getByText("In progress · 2")).toBeVisible();
  await expect(row(page, "First job")).toHaveCount(0);
});

test("opens the editor with enter and closes it with escape", async ({ page }) => {
  await page.keyboard.press("g");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Edit task")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Edit task")).toBeHidden();
});

test("opens help with ? and lists the shortcuts it implements", async ({ page }) => {
  await page.keyboard.press("?");
  await expect(page.getByText("Keyboard shortcuts")).toBeVisible();
  for (const key of ["d", "b", "s", "m", "u / ⌘Z"]) {
    await expect(page.locator("kbd", { hasText: new RegExp(`^${key}$`) }).first()).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByText("Keyboard shortcuts")).toBeHidden();
});

test("focuses quick-add with n, and ⌘K from anywhere", async ({ page }) => {
  await page.keyboard.press("n");
  await expect(page.getByPlaceholder(/Add task/)).toBeFocused();
  await page.keyboard.press("Escape");

  await page.locator("body").click();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByPlaceholder(/Add task/)).toBeFocused();
});

test("shortcuts stay out of the way while typing", async ({ page }) => {
  await page.getByPlaceholder(/Add task/).fill("dbsx typing everything");
  await expect(page.getByPlaceholder(/Add task/)).toHaveValue("dbsx typing everything");
  await expect(page.getByText("In progress · 3")).toBeVisible();
});
