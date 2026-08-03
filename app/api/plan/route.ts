import { queued, readStored, writeStored } from "@/lib/plan-store";

/**
 * The whole plan, exactly as stored — the channel the browser autosaves down.
 *
 * Deliberately unvalidating: it is the app talking to itself, and a save is not
 * the moment to argue with it. Everything a caller sends by hand goes through
 * the /api/tasks family or POST /api/import instead, which check what they are
 * given before it lands.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await readStored());
  } catch (err) {
    // a missing file is a first run; a database that won't answer is not
    console.error("plan GET failed:", err);
    return Response.json(null, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const body = await req.json();
  try {
    await queued(() => writeStored(body));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("plan PUT failed:", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
