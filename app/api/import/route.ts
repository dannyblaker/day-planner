import { fail, ok, readBody } from "@/lib/api-http";
import { planStats } from "@/lib/plan-doc";
import { ApiError, importPlan } from "@/lib/plan-ops";
import { editPlan } from "@/lib/plan-store";

/**
 * Take a document back in — an export of this app's, or anything with the same
 * `tasks` and `goals` shape.
 *
 *   POST /api/import              replace the plan with this one
 *   POST /api/import?mode=merge   upsert by id, leaving everything else alone
 *
 * Derived fields (`status`, `depth`, `dependents`) are ignored rather than
 * refused, so the file /api/export hands out can go straight back in. The whole
 * document is validated first: if a dependency points nowhere, or the graph
 * contains a loop, nothing is written and the reply says what was wrong.
 *
 * A replace keeps the existing share token unless the document carries one, so
 * links you have already sent people keep working.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const mode = new URL(req.url).searchParams.get("mode") ?? "replace";
    if (mode !== "replace" && mode !== "merge")
      throw new ApiError(400, 'mode must be "replace" or "merge"');

    const input = await readBody(req);
    const result = await editPlan((plan) => {
      const r = importPlan(plan, input, mode);
      return { plan: r.plan, result: { summary: r.summary, plan: r.plan } };
    });
    return ok({ ...result.summary, stats: planStats(result.plan) });
  } catch (err) {
    return fail(err);
  }
}
