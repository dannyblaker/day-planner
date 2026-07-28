import { expect, quickAdd, row, test } from "./fixtures";

const undoBar = (page: import("@playwright/test").Page) => page.getByRole("status");
const clearControl = (page: import("@playwright/test").Page) =>
  page.getByTitle(/remove finished tasks/);

async function twoDoneOneLeft(page: import("@playwright/test").Page) {
  await quickAdd(page, "Finished one 30m", "Finished one");
  await quickAdd(page, "Finished two 30m", "Finished two");
  await quickAdd(page, "Still going 30m", "Still going");
  for (const title of ["Finished one", "Finished two"]) {
    await row(page, title).hover();
    await row(page, title).getByRole("button", { name: /done/i }).click();
  }
  await expect(page.getByText("Done · 2")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "DayFlow" })).toBeVisible();
  await twoDoneOneLeft(page);
});

test("clears the day's finished work and offers an undo", async ({ page, planServer }) => {
  await clearControl(page).click();

  await expect(page.getByText("Done · 2")).toBeHidden();
  await expect(row(page, "Still going")).toBeVisible();
  await expect(undoBar(page)).toContainText("Cleared 2 done tasks");

  await planServer.settled();
  expect(planServer.titles()).toEqual(["Still going"]);
});

test("offers no clear control when nothing is finished", async ({ page }) => {
  await clearControl(page).click();
  await expect(clearControl(page)).toHaveCount(0);
});

test("puts the tasks back from the undo button", async ({ page, planServer }) => {
  await clearControl(page).click();
  await undoBar(page).getByRole("button", { name: /undo/i }).click();

  await expect(page.getByText("Done · 2")).toBeVisible();
  await expect(undoBar(page)).toHaveCount(0);
  await planServer.settled();
  expect(planServer.titles().sort()).toEqual(["Finished one", "Finished two", "Still going"]);
});

test("puts them back from the u key", async ({ page }) => {
  await clearControl(page).click();
  await page.locator("body").click();
  await page.keyboard.press("u");
  await expect(page.getByText("Done · 2")).toBeVisible();
});

test("puts them back from ctrl+z", async ({ page }) => {
  await clearControl(page).click();
  await page.locator("body").click();
  await page.keyboard.press("Control+z");
  await expect(page.getByText("Done · 2")).toBeVisible();
});

test("restores dependency links that pointed at the cleared work", async ({
  page,
  planServer,
}) => {
  // >finished matches the first task whose title starts with it; a second word
  // would be read as part of this task's own title
  await quickAdd(page, "Depends on it 20m >finished", "Depends on it");
  await planServer.settled();
  expect(planServer.tasks().find((t) => t.title === "Depends on it")!.dependsOn).toHaveLength(1);

  await clearControl(page).click();
  await planServer.settled();
  expect(planServer.tasks().find((t) => t.title === "Depends on it")!.dependsOn).toEqual([]);

  await undoBar(page).getByRole("button", { name: /undo/i }).click();
  await planServer.settled();
  expect(planServer.tasks().find((t) => t.title === "Depends on it")!.dependsOn).toHaveLength(1);
});

test("keeps work added while the undo offer was up", async ({ page, planServer }) => {
  await clearControl(page).click();
  await quickAdd(page, "Typed during the window 15m", "Typed during the window");
  await undoBar(page).getByRole("button", { name: /undo/i }).click();

  await planServer.settled();
  expect(planServer.titles().sort()).toEqual([
    "Finished one",
    "Finished two",
    "Still going",
    "Typed during the window",
  ]);
});

test("dismisses the offer without restoring", async ({ page }) => {
  await clearControl(page).click();
  await undoBar(page).getByRole("button", { name: "Dismiss" }).click();
  await expect(undoBar(page)).toHaveCount(0);
  await expect(page.getByText("Done · 2")).toBeHidden();
});

test("withdraws the offer after ten seconds", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 6, 28, 8, 0, 0) });
  await clearControl(page).click();
  await expect(undoBar(page)).toBeVisible();

  await page.clock.fastForward(9_000);
  await expect(undoBar(page)).toBeVisible();

  await page.clock.fastForward(2_000);
  await expect(undoBar(page)).toHaveCount(0);
  await expect(page.getByText("Done · 2")).toBeHidden();
});
