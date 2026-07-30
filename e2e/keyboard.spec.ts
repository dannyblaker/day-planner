import { expect, quickAdd, row, test } from "./fixtures";

const selected = (page: import("@playwright/test").Page) =>
  page.locator("[data-task-row].border-indigo-400\\/70");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DayFlow" })).toBeVisible();
  await quickAdd(page, "First job 30m", "First job");
  await quickAdd(page, "Second job 30m", "Second job");
  await quickAdd(page, "Third job 30m", "Third job");
  // adding a task selects it — start each test from a clean slate instead
  await page.getByRole("heading", { name: "DayFlow" }).click();
  await page.keyboard.press("Escape");
  await expect(selected(page)).toHaveCount(0);
});

test("moves the selection with j and k", async ({ page }) => {
  await page.keyboard.press("j");
  await expect(selected(page)).toContainText("First job");
  await page.keyboard.press("j");
  await expect(selected(page)).toContainText("Second job");
  await page.keyboard.press("k");
  await expect(selected(page)).toContainText("First job");
});

test("stops at the ends rather than wrapping", async ({ page }) => {
  await page.keyboard.press("k");
  await expect(selected(page)).toContainText("First job");
  for (let i = 0; i < 5; i++) await page.keyboard.press("j");
  await expect(selected(page)).toContainText("Third job");
});

test("reorders the queue with shift+J and shift+K", async ({ page, planServer }) => {
  await page.keyboard.press("j");
  await page.keyboard.press("J");
  await planServer.settled();

  const order = planServer
    .tasks()
    .sort((a, b) => a.order - b.order)
    .map((t) => t.title);
  expect(order).toEqual(["Second job", "First job", "Third job"]);
});

test("changes priority and duration on the selected task", async ({ page, planServer }) => {
  await page.keyboard.press("j");
  await page.keyboard.press("1");
  await page.keyboard.press("+");
  await planServer.settled();

  const first = planServer.tasks().find((t) => t.title === "First job")!;
  expect(first.priority).toBe(1);
  expect(first.duration).toBe(45);
});

test("sorts the queue by priority with s", async ({ page, planServer }) => {
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await page.keyboard.press("j"); // Third job
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
  await page.keyboard.press("j");
  await page.keyboard.press("b");
  await expect(page.getByText("Blocked · 1")).toBeVisible();
  await page.keyboard.press("b");
  await expect(page.getByText("Queue · 3")).toBeVisible();
});

test("starts and pauses the timer with space", async ({ page }) => {
  await page.keyboard.press("j");
  await page.keyboard.press(" ");
  await expect(page.getByText("In progress")).toBeVisible();
  await page.keyboard.press(" ");
  await expect(page.getByText("Up next")).toBeVisible();
});

test("deletes with x", async ({ page }) => {
  await page.keyboard.press("j");
  await page.keyboard.press("x");
  await expect(page.getByText("Queue · 2")).toBeVisible();
  await expect(row(page, "First job")).toHaveCount(0);
});

test("opens the editor with enter and closes it with escape", async ({ page }) => {
  await page.keyboard.press("j");
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
  await expect(page.getByText("Queue · 3")).toBeVisible();
});
