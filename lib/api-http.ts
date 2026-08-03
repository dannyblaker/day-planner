import { ApiError } from "./plan-ops";

/**
 * The shape every route answers in.
 *
 * Success is `{ ok: true, … }` and failure is `{ ok: false, error, details? }`,
 * so a caller can branch on one field without consulting the status code — and
 * `details` is a list because a request describing twenty tasks deserves to
 * hear about all twenty problems in one round trip.
 *
 * Note there is no authentication here, on purpose: the API is exactly as open
 * as the app it edits, which is to say anyone who can reach the port. That is
 * fine on a laptop and worth thinking about before you expose the port.
 */

export function ok(data: Record<string, unknown> = {}, status = 200): Response {
  return Response.json({ ok: true, ...data }, { status });
}

export function fail(err: unknown): Response {
  if (err instanceof ApiError)
    return Response.json(
      { ok: false, error: err.message, ...(err.details ? { details: err.details } : {}) },
      { status: err.status }
    );
  console.error("api route failed:", err);
  return Response.json({ ok: false, error: "Something went wrong" }, { status: 500 });
}

/** The request body as JSON, with a 400 rather than a stack trace when it isn't. */
export async function readBody(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) throw new ApiError(400, "A JSON body is required");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "The request body is not valid JSON");
  }
}

/** `?ids=a,b,c`, repeated `?ids=a&ids=b`, or `{ ids: [...] }` in the body. */
export function idsFromQuery(url: URL): string[] {
  return url.searchParams
    .getAll("ids")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
}

/** A query flag: present and not "false"/"0" means yes. */
export function flag(url: URL, name: string): boolean {
  const v = url.searchParams.get(name);
  return v !== null && v !== "false" && v !== "0";
}
