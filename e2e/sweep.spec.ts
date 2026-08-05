import { expect, flowNode, quickAdd, row, test } from "./fixtures";

/**
 * Finished work takes itself off the board. The rest of the suite turns this off
 * (see fixtures.ts) so that specs marking things done aren't racing a five-second
 * timer; this one is the timer.
 */
test.use({ sweepPref: "on" });

const countdown = (page: import("@playwright/test").Page, title: string) =>
  row(page, title).getByTitle(/re-open the task to keep it/);

const markDone = async (page: import("@playwright/test").Page, title: string) => {
  await row(page, title).hover();
  await row(page, title).getByRole("button", { name: /✓ done/i }).click();
};

const reopen = async (page: import("@playwright/test").Page, title: string) => {
  await row(page, title).hover();
  await row(page, title).getByRole("button", { name: /reopen/i }).first().click();
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Concurrent Crocodiles" })).toBeVisible();
});

test("counts a finished task down and then takes it away", async ({ page, planServer }) => {
  await quickAdd(page, "Write the report", "Write the report");
  await markDone(page, "Write the report");

  // the countdown shows on the row and on the crocodile
  await expect(countdown(page, "Write the report")).toBeVisible();
  await expect(flowNode(page, "Write the report").getByText(/🧹/)).toBeVisible();

  await expect(row(page, "Write the report")).toHaveCount(0, { timeout: 8000 });
  await planServer.settled();
  expect(planServer.titles()).toEqual([]);
});

test("keeps the task if it is re-opened before the count runs out", async ({ page }) => {
  await quickAdd(page, "Write the report", "Write the report");
  await markDone(page, "Write the report");
  await expect(countdown(page, "Write the report")).toBeVisible();

  await reopen(page, "Write the report");
  await expect(countdown(page, "Write the report")).toHaveCount(0);

  await page.waitForTimeout(6000);
  await expect(row(page, "Write the report")).toBeVisible();
});

test("waits for the whole chain, then takes all of it", async ({ page }) => {
  await quickAdd(page, "Design it", "Design it");
  await quickAdd(page, "Build it >design", "Build it");

  // finishing the first of a chain starts nothing: something still waits on it
  await markDone(page, "Design it");
  await expect(countdown(page, "Design it")).toHaveCount(0);
  await page.waitForTimeout(6000);
  await expect(row(page, "Design it")).toBeVisible();

  // finishing the last of it starts the countdown on both
  await markDone(page, "Build it");
  await expect(countdown(page, "Design it")).toBeVisible();
  await expect(countdown(page, "Build it")).toBeVisible();

  await expect(page.locator("[data-task-row]")).toHaveCount(0, { timeout: 8000 });
});

test("stops sweeping when the broom is switched off, and remembers it", async ({
  page,
  planServer,
}) => {
  await page.getByRole("button", { name: /sweeping finished work/i }).click();
  await quickAdd(page, "Write the report", "Write the report");
  await markDone(page, "Write the report");

  await expect(countdown(page, "Write the report")).toHaveCount(0);
  await page.waitForTimeout(6000);
  await expect(row(page, "Write the report")).toBeVisible();

  // per device, and applied before the first paint
  await planServer.settled();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-sweep", "off");
  await expect(row(page, "Write the report")).toBeVisible();
});

test("leaves work that was already finished when the app opened", async ({
  page,
  planServer,
}) => {
  await quickAdd(page, "Long since done", "Long since done");
  // switch the sweep off, finish it, and reload: it arrives already done
  await page.getByRole("button", { name: /sweeping finished work/i }).click();
  await markDone(page, "Long since done");
  await page.getByRole("button", { name: /sweeping finished work/i }).click();
  await planServer.settled();
  await page.reload();

  await expect(row(page, "Long since done")).toBeVisible();
  await page.waitForTimeout(6000);
  await expect(row(page, "Long since done")).toBeVisible();
});
