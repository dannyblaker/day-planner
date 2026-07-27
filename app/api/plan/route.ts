import { promises as fs } from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "plan.json");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const text = await fs.readFile(FILE, "utf8");
    return Response.json(JSON.parse(text));
  } catch {
    return Response.json(null);
  }
}

export async function PUT(req: Request) {
  const body = await req.json();
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(body, null, 1));
  return Response.json({ ok: true });
}
