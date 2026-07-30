import { SHARE_TOKEN, expect, quickAdd, row, test } from "./fixtures";

test.describe("the live share link", () => {
  test("shows today's plan read-only", async ({ page, planServer }) => {
    await page.goto("/");
    await quickAdd(page, "Draft the proposal 1h", "Draft the proposal");
    await quickAdd(page, "Standup 15m", "Standup");
    await planServer.settled();

    await page.goto(`/share/${SHARE_TOKEN}`);
    await expect(page.getByText("live · read-only")).toBeVisible();
    await expect(page.getByText("Draft the proposal")).toBeVisible();
    await expect(page.getByText("0/2 done")).toBeVisible();
  });

  test("offers no way to edit the plan", async ({ page, planServer }) => {
    await page.goto("/");
    await quickAdd(page, "Draft the proposal 1h", "Draft the proposal");
    await planServer.settled();

    await page.goto(`/share/${SHARE_TOKEN}`);
    await expect(page.getByText("Draft the proposal")).toBeVisible();

    await expect(page.getByLabel("Mark task done")).toHaveCount(0);
    await expect(page.getByPlaceholder(/Add task/)).toHaveCount(0);
    await expect(page.getByText("Queue ·")).toHaveCount(0);

    const savesBefore = planServer.saveCount();
    await page.getByText("Draft the proposal").click();
    await page.waitForTimeout(800);
    expect(planServer.saveCount()).toBe(savesBefore);
  });

  test("surfaces what is in progress and what is stuck", async ({ page, planServer }) => {
    await page.goto("/");
    await quickAdd(page, "Running now 1h", "Running now");
    await quickAdd(page, "Ship it 20m *waiting-on-legal", "Ship it");
    await row(page, "Running now").hover();
    await row(page, "Running now").getByRole("button", { name: "start" }).click();
    await planServer.settled();

    await page.goto(`/share/${SHARE_TOKEN}`);
    await expect(page.getByText(/working on now/)).toBeVisible();
    await expect(page.getByText("Running now").first()).toBeVisible();
    await expect(page.getByText(/blocked \(1\)/)).toBeVisible();
    await expect(page.getByText(/waiting on legal/).first()).toBeVisible();
  });

  test("rejects a wrong token", async ({ page }) => {
    await page.goto("/share/not-the-real-token");
    await expect(page.getByText("Invalid share link.")).toBeVisible();
  });

  test("keeps up as the plan changes", async ({ page, context, planServer }) => {
    await page.goto("/");
    await quickAdd(page, "First task 30m", "First task");
    await planServer.settled();

    const viewer = await context.newPage();
    await viewer.goto(`/share/${SHARE_TOKEN}`);
    await expect(viewer.getByText("First task")).toBeVisible();

    await quickAdd(page, "Added later 30m", "Added later");
    await planServer.settled();
    // the share view polls every 5 seconds
    await expect(viewer.getByText("Added later")).toBeVisible({ timeout: 10_000 });
    await viewer.close();
  });
});
