import { BrowserContext, Page, test as base, expect } from "@playwright/test";

export { expect };

export interface Plan {
  goals: { id: string; name: string; color: string }[];
  tasks: Task[];
  shareToken: string;
}
interface Task {
  id: string;
  title: string;
  priority: number;
  done: boolean;
  order: number;
  dependsOn: string[];
  createdAt: number;
  [key: string]: unknown;
}

export const SHARE_TOKEN = "e2e-share-token";

/** Pinned so `createdAt` and the like are facts of the run, not of the clock. */
export const E2E_NOW = new Date(2026, 6, 28, 8, 0, 0);

export function emptyPlan(): Plan {
  return {
    goals: [{ id: "g1", name: "deep-work", color: "#818cf8" }],
    tasks: [],
    shareToken: SHARE_TOKEN,
  };
}

/** In-memory stand-in for the plan API, so tests never touch data/plan.json. */
export interface PlanServer {
  /** the plan as the "server" currently holds it */
  current(): Plan;
  tasks(): Task[];
  titles(): string[];
  /** how many saves the client has pushed */
  saveCount(): number;
  /** wait for the debounced autosave to land */
  settled(): Promise<void>;
}

async function installPlanRoute(
  context: BrowserContext,
  initial: Plan
): Promise<PlanServer> {
  let plan = structuredClone(initial);
  let saves = 0;

  // context-scoped, so a second tab (the share view) is stubbed too and no
  // request can reach the real route
  await context.route("**/api/plan", async (route) => {
    if (route.request().method() === "PUT") {
      plan = route.request().postDataJSON();
      saves += 1;
      await route.fulfill({ json: { ok: true } });
    } else {
      await route.fulfill({ json: plan });
    }
  });

  return {
    current: () => plan,
    tasks: () => plan.tasks ?? [],
    titles: () => (plan.tasks ?? []).map((t) => t.title),
    saveCount: () => saves,
    settled: async () => {
      const before = saves;
      // the client debounces at 600ms; wait past that, then for the write
      await new Promise((r) => setTimeout(r, 700));
      await expect
        .poll(() => saves, { timeout: 5000, message: "waiting for autosave" })
        .toBeGreaterThanOrEqual(before);
    },
  };
}

/**
 * Both fixtures are automatic: every test gets a stubbed plan API and fails if
 * the page logged an error, whether or not it names them.
 */
export const test = base.extend<{
  planServer: PlanServer;
  consoleErrors: string[];
  frozenClock: void;
}>({
  // setFixedTime freezes Date without stopping timers, so the debounced
  // autosave and the reflow interval still run.
  frozenClock: [
    async ({ context }, use) => {
      await context.clock.setFixedTime(E2E_NOW);
      await use();
    },
    { auto: true },
  ],
  planServer: [
    async ({ context }, use) => {
      await use(await installPlanRoute(context, emptyPlan()));
    },
    { auto: true },
  ],
  consoleErrors: [
    async ({ context }, use) => {
      const errors: string[] = [];
      context.on("page", (p) => {
        p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
        p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      });
      await use(errors);
      expect(errors, "the page logged errors").toEqual([]);
    },
    { auto: true },
  ],
});

/** Type a quick-add line and wait for the row to appear. */
export async function quickAdd(page: Page, input: string, title = input.split(/\s+\d|\s+[!#@>~^*]/)[0]) {
  await page.getByPlaceholder(/Add task/).fill(input);
  await page.getByPlaceholder(/Add task/).press("Enter");
  await expect(page.locator("[data-task-row]").filter({ hasText: title })).toBeVisible();
}

export const row = (page: Page, title: string) =>
  page.locator("[data-task-row]").filter({ hasText: title });

export const flowNode = (page: Page, title: string) =>
  page.locator("[data-flow-node]").filter({ hasText: title });
