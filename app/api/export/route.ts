import { fail, flag } from "@/lib/api-http";
import { planDocument } from "@/lib/plan-doc";
import { readPlan } from "@/lib/plan-store";

/**
 * The whole plan as one JSON document: goals, tasks, every dependency, and the
 * derived state the app shows you — status, depth, dependents, totals.
 *
 *   GET /api/export                 pretty-printed, in the browser
 *   GET /api/export?download=1      as a file
 *   GET /api/export?pretty=0        compact, for a script
 *   GET /api/export?format=plan     just the stored document, no derivations
 *
 * `format=document` (the default) is what POST /api/import reads back, and it
 * is the same bytes the app's own JSON button downloads — the derived fields
 * are ignored on the way in, so a round trip is lossless either way.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const plan = await readPlan();
    const raw = url.searchParams.get("format") === "plan";
    const doc = raw ? plan : planDocument(plan);
    const pretty = url.searchParams.get("pretty") !== "0";
    const body = JSON.stringify(doc, null, pretty ? 2 : 0);

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(flag(url, "download")
          ? {
              "Content-Disposition": `attachment; filename="crocodiles-${stamp}.json"`,
            }
          : {}),
      },
    });
  } catch (err) {
    return fail(err);
  }
}
