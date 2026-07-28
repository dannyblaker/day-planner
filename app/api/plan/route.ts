import { promises as fs } from "fs";
import path from "path";
import { dbGetPlan, dbPutPlan } from "@/lib/db";

const FILE = path.join(process.cwd(), "data", "plan.json");
/** Named to avoid the `use…` prefix, which reads as a React hook to eslint. */
const dbBacked = () => !!process.env.DATABASE_URL;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (dbBacked()) return Response.json(await dbGetPlan());
    const text = await fs.readFile(FILE, "utf8");
    return Response.json(JSON.parse(text));
  } catch (err) {
    if (dbBacked()) {
      console.error("plan GET failed:", err);
      return Response.json(null, { status: 500 });
    }
    return Response.json(null); // no file yet — first run
  }
}

export async function PUT(req: Request) {
  const body = await req.json();
  try {
    if (dbBacked()) {
      await dbPutPlan(body);
    } else {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(body, null, 1));
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error("plan PUT failed:", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
