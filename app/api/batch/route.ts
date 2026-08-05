import { fail, ok, readBody } from "@/lib/api-http";
import { dependencyEdges, planStats, taskViews } from "@/lib/plan-doc";
import { applyBatch } from "@/lib/plan-ops";
import { editPlan } from "@/lib/plan-store";

/**
 * Everything in one request, applied all-or-nothing.
 *
 *   POST /api/batch
 *   {
 *     "goals":    { "create": [...], "update": [...], "delete": ["id"] },
 *     "create":   [{ "title": "Ship it", "dependsOn": ["a1b2"] }],
 *     "quickAdd": ["Write report !1 #deep-work"],
 *     "update":   [{ "id": "a1b2", "done": true }],
 *     "delete":   ["c3d4"]
 *   }
 *
 * or, for the round trip — read /api/tasks, edit the array, hand it back:
 *
 *   { "tasks": [ …the whole list… ] }
 *
 * The two forms are exclusive, because they disagree about what leaving a task
 * out means: in the first form it means "don't touch it", in the second it
 * means "delete it".
 *
 * The whole edit is assembled and checked before anything is stored, so a batch
 * may pass through arrangements the graph would refuse on their own — adding an
 * edge and cutting it again, or removing a prerequisite along with the task
 * that needed it — and is judged only on where it ends up. If any part of it is
 * rejected, none of it happened.
 *
 * The response carries the resulting plan in full, so a caller that batches is
 * never left guessing what it now looks like.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const input = await readBody(req);
    const result = await editPlan((plan) => {
      const r = applyBatch(plan, input);
      return { plan: r.plan, result: { summary: r.summary, plan: r.plan } };
    });
    const { plan, summary } = result;
    return ok({
      summary,
      tasks: taskViews(plan.tasks),
      goals: plan.goals,
      dependencies: dependencyEdges(plan.tasks),
      stats: planStats(plan),
    });
  } catch (err) {
    return fail(err);
  }
}
