import { fail, idsFromQuery, ok, readBody } from "@/lib/api-http";
import { taskViews } from "@/lib/plan-doc";
import { ApiError, asIds, editDependencies, findTask } from "@/lib/plan-ops";
import { editPlan, readPlan } from "@/lib/plan-store";

/**
 * The edges into and out of one task.
 *
 *   GET     what it waits for, and what waits for it
 *   PUT     replace the list it waits for
 *   POST    add edges (`{ add: [...] }`, or a bare array)
 *   DELETE  remove edges (`?ids=…`, or `{ remove: [...] }`)
 *
 * All of it is reachable through the task's `dependsOn` field as well; this is
 * here because a dependency isn't really a property of a task, it is a claim
 * about two of them, and it reads better when you can say so directly.
 *
 * Every write is checked against the finished graph, so an edge that would
 * close a loop comes back 400 with the loop spelled out.
 */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const plan = await readPlan();
    findTask(plan, id);
    const view = taskViews(plan.tasks).find((t) => t.id === id)!;
    const title = (tid: string) => plan.tasks.find((t) => t.id === tid)?.title ?? "";
    return ok({
      id,
      dependsOn: view.dependsOn.map((d) => ({ id: d, title: title(d) })),
      dependents: view.dependents.map((d) => ({ id: d, title: title(d) })),
      depth: view.depth,
      status: view.status,
    });
  } catch (err) {
    return fail(err);
  }
}

async function edit(req: Request, ctx: Ctx, key: "set" | "add" | "remove") {
  const { id } = await ctx.params;
  const input = await readBody(req);
  const bag = input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
  const ids = Array.isArray(input)
    ? input
    : bag?.[key] !== undefined
      ? bag[key]
      : bag?.dependsOn;
  if (ids === undefined)
    throw new ApiError(400, `Send an array of task ids, or { "${key}": [...] }`);

  const task = await editPlan((plan) => {
    const r = editDependencies(plan, id, { [key]: asIds(ids, key) });
    return { plan: r.plan, result: r.task };
  });
  return ok({ task });
}

export async function PUT(req: Request, ctx: Ctx) {
  try {
    return await edit(req, ctx, "set");
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    return await edit(req, ctx, "add");
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const fromQuery = idsFromQuery(new URL(req.url));
    if (!fromQuery.length) return await edit(req, ctx, "remove");
    const task = await editPlan((plan) => {
      const r = editDependencies(plan, id, { remove: fromQuery });
      return { plan: r.plan, result: r.task };
    });
    return ok({ task });
  } catch (err) {
    return fail(err);
  }
}
