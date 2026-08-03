import { promises as fs } from "fs";
import path from "path";
import { dbGetPlan, dbPutPlan } from "./db";
import { normalizePlan } from "./plan-ops";
import { Plan } from "./types";

/**
 * Where the plan lives, on the server side of every route.
 *
 * One document, in Postgres when DATABASE_URL is set and in data/plan.json when
 * it isn't. The app has always saved by replacing the whole thing, which is
 * fine for a browser holding the only copy — but the API edits it a task at a
 * time, and a read-modify-write is only safe if nothing interleaves with it, so
 * writes queue behind each other here.
 *
 * That covers concurrent API calls. It does not cover an open browser tab: the
 * tab autosaves its whole plan, so a change made through the API while a tab is
 * open will be overwritten the next time anything in that tab changes. Reload
 * the tab after driving the API, or drive the API with no tab open.
 */

/** Named to avoid the `use…` prefix, which reads as a React hook to eslint. */
export const dbBacked = () => !!process.env.DATABASE_URL;

/** Resolved per call, not at import: tests point cwd at a temp directory. */
const file = () => path.join(process.cwd(), "data", "plan.json");

/**
 * The stored document, or null when there isn't one yet. A missing or corrupt
 * file is a first run; a database that won't answer is an error worth raising.
 */
export async function readStored(): Promise<unknown | null> {
  if (dbBacked()) return (await dbGetPlan()) ?? null;
  try {
    return JSON.parse(await fs.readFile(file(), "utf8"));
  } catch {
    return null;
  }
}

export async function writeStored(data: unknown): Promise<void> {
  if (dbBacked()) {
    await dbPutPlan(data);
    return;
  }
  await fs.mkdir(path.dirname(file()), { recursive: true });
  await fs.writeFile(file(), JSON.stringify(data, null, 1));
}

export async function readPlan(): Promise<Plan> {
  return normalizePlan(await readStored());
}

let queue: Promise<unknown> = Promise.resolve();

/** Run after every write already in flight, and before every write after it. */
export function queued<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work);
  // the queue exists to sequence, not to propagate: a rejected write must still
  // let the next one run, so what the next call waits on never fails
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Read the plan, change it, write it back — with no other write in between.
 *
 * `edit` gets the current plan and returns the one to store plus whatever the
 * route wants to say about it. Throwing from `edit` (which is how the ops layer
 * rejects invalid input) leaves the stored plan untouched.
 */
export async function editPlan<T>(
  edit: (plan: Plan) => { plan: Plan; result: T } | Promise<{ plan: Plan; result: T }>
): Promise<T> {
  return queued(async () => {
    const { plan, result } = await edit(await readPlan());
    await writeStored(plan);
    return result;
  });
}
