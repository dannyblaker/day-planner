import { expect, quickAdd, test } from "./fixtures";

/**
 * The JSON button hands you the board as data — the same document GET
 * /api/export serves, built in the browser from what is on screen. What is
 * worth proving here is that the derived state travels with it: a file of tasks
 * with no statuses in it would make you re-implement the graph to read it.
 */

test.describe("exporting the plan as JSON", () => {
  test("downloads every task, every dependency and the derived status", async ({ page }) => {
    await page.goto("/");
    await quickAdd(page, "Draft the proposal 1h !1 #deep-work", "Draft the proposal");
    await quickAdd(page, "Review it 30m >draft", "Review it");
    await quickAdd(page, "CI run 45m ~", "CI run");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^concurrencyflow-\d{4}-\d{2}-\d{2}\.json$/);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const doc = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    expect(doc.app).toBe("ConcurrencyFlow");
    expect(doc.tasks.map((t: { title: string }) => t.title)).toEqual([
      "Draft the proposal",
      "Review it",
      "CI run",
    ]);

    const byTitle = Object.fromEntries(
      doc.tasks.map((t: { title: string }) => [t.title, t])
    );
    // the graph, spelled out both ways: on the task, and as its own edge list
    expect(byTitle["Review it"].dependsOn).toEqual([byTitle["Draft the proposal"].id]);
    expect(doc.dependencies).toEqual([
      { from: byTitle["Draft the proposal"].id, to: byTitle["Review it"].id },
    ]);
    expect(byTitle["Draft the proposal"].status).toBe("in-progress");
    expect(byTitle["Review it"].status).toBe("todo");
    expect(byTitle["Review it"].depth).toBe(1);
    expect(byTitle["CI run"].parallel).toBe(true);

    expect(doc.goals.map((g: { name: string }) => g.name)).toContain("deep-work");
    expect(doc.stats).toMatchObject({
      tasks: 3,
      dependencies: 1,
      byStatus: { "in-progress": 2, todo: 1, done: 0 },
      plannedMinutes: 135,
    });
  });

  test("exports what is on screen, not what was last saved", async ({ page }) => {
    await page.goto("/");
    await quickAdd(page, "Just typed 25m", "Just typed");

    // no wait for the 600ms autosave: the download is built from the store
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "JSON" }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const doc = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    expect(doc.tasks.map((t: { title: string }) => t.title)).toEqual(["Just typed"]);
  });
});
