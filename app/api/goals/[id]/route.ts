import { fail, ok, readBody } from "@/lib/api-http";
import { goalViews } from "@/lib/plan-doc";
import { ApiError, deleteGoals, updateGoals } from "@/lib/plan-ops";
import { editPlan, readPlan } from "@/lib/plan-store";
import { Plan } from "@/lib/types";

/** One goal: read it with its totals, rename or recolour it, or remove it. */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function view(plan: Plan, id: string) {
  const goal = goalViews(plan).find((g) => g.id === id);
  if (!goal) throw new ApiError(404, `No goal with id "${id}"`);
  return goal;
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    return ok({ goal: view(await readPlan(), id) });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const patch = { ...((await readBody(req)) as Record<string, unknown>), id };
    const plan = await editPlan((plan) => {
      const r = updateGoals(plan, [patch]);
      return { plan: r.plan, result: r.plan };
    });
    return ok({ goal: view(plan, id) });
  } catch (err) {
    return fail(err);
  }
}

/** The goal goes; its tasks stay, with no goal. Deleting a label is not deleting work. */
export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const result = await editPlan((plan) => {
      const r = deleteGoals(plan, [id]);
      return { plan: r.plan, result: { goal: r.goals[0], unassigned: r.unassigned } };
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
