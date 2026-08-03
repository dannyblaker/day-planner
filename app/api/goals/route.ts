import { fail, idsFromQuery, ok, readBody } from "@/lib/api-http";
import { goalViews } from "@/lib/plan-doc";
import { ApiError, asArray, asIds, createGoals, deleteGoals, updateGoals } from "@/lib/plan-ops";
import { editPlan, readPlan } from "@/lib/plan-store";

/**
 * Goals, with the work counted against them.
 *
 *   GET     every goal, plus how much of its work is planned and done
 *   POST    create one, or `{ goals: [...] }`
 *   PATCH   update many, each naming its id
 *   DELETE  remove by id — the tasks survive, unassigned
 *
 * A task can also name a goal that doesn't exist yet (`"goal": "deep-work"` on
 * any task write) and it will be created, which mirrors what `#goal` does in
 * quick-add. This endpoint is for naming and colouring them deliberately.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plan = await readPlan();
    const goals = goalViews(plan);
    return ok({ count: goals.length, goals });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = await readBody(req);
    const bag = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const inputs = Array.isArray(input)
      ? input
      : bag.goals !== undefined
        ? asArray(bag.goals, "goals")
        : [input];

    const goals = await editPlan((plan) => {
      const r = createGoals(plan, inputs);
      return { plan: r.plan, result: r.goals };
    });
    return ok({ count: goals.length, goals }, 201);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const input = await readBody(req);
    const inputs = Array.isArray(input)
      ? input
      : asArray((input as Record<string, unknown>)?.goals, "goals");
    const goals = await editPlan((plan) => {
      const r = updateGoals(plan, inputs);
      return { plan: r.plan, result: r.goals };
    });
    return ok({ count: goals.length, goals });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const ids = idsFromQuery(new URL(req.url));
    if (!ids.length) throw new ApiError(400, "Say what to delete: ?ids=a,b");
    const result = await editPlan((plan) => {
      const r = deleteGoals(plan, asIds(ids, "ids"));
      return { plan: r.plan, result: { goals: r.goals, unassigned: r.unassigned } };
    });
    return ok({ count: result.goals.length, ...result });
  } catch (err) {
    return fail(err);
  }
}
