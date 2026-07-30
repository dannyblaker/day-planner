/**
 * The plan route is the persistence boundary: file-backed in dev, Postgres when
 * DATABASE_URL is set. Both paths are exercised here against a temp directory
 * and a stubbed db module — never the real data/plan.json.
 */
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makePlan, makeTask } from "./factory";

const dbGetPlan = vi.fn();
const dbPutPlan = vi.fn();
vi.mock("@/lib/db", () => ({
  dbGetPlan: (...args: unknown[]) => dbGetPlan(...args),
  dbPutPlan: (...args: unknown[]) => dbPutPlan(...args),
}));

let tmp: string;

/** the route captures cwd at import time, so point it somewhere safe first */
async function loadRoute() {
  vi.resetModules();
  vi.spyOn(process, "cwd").mockReturnValue(tmp);
  return import("@/app/api/plan/route");
}

const put = (body: unknown) =>
  new Request("http://localhost/api/plan", {
    method: "PUT",
    body: JSON.stringify(body),
  });

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dayflow-route-"));
  delete process.env.DATABASE_URL;
  dbGetPlan.mockReset();
  dbPutPlan.mockReset();
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
  delete process.env.DATABASE_URL;
});

describe("file-backed storage (no DATABASE_URL)", () => {
  it("returns null on a first run, rather than an error", async () => {
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("writes the plan and reads it back", async () => {
    const { GET, PUT } = await loadRoute();
    const plan = makePlan();

    const saved = await PUT(put(plan));
    expect(await saved.json()).toEqual({ ok: true });

    expect(await GET().then((r) => r.json())).toEqual(plan);
    // and it really is on disk, where docker-compose expects it
    const onDisk = await fs.readFile(path.join(tmp, "data", "plan.json"), "utf8");
    expect(JSON.parse(onDisk)).toEqual(plan);
  });

  it("creates the data directory if it is missing", async () => {
    const { PUT } = await loadRoute();
    await PUT(put(makePlan()));
    await expect(fs.stat(path.join(tmp, "data"))).resolves.toBeTruthy();
  });

  it("overwrites rather than appending on the next save", async () => {
    const { GET, PUT } = await loadRoute();
    await PUT(put(makePlan([makeTask({ title: "First" })])));
    await PUT(put(makePlan([makeTask({ title: "Second" })])));
    const stored = await GET().then((r) => r.json());
    expect(stored.tasks.map((t: { title: string }) => t.title)).toEqual(["Second"]);
  });

  it("survives a corrupt file by reporting no plan", async () => {
    const { GET } = await loadRoute();
    await fs.mkdir(path.join(tmp, "data"), { recursive: true });
    await fs.writeFile(path.join(tmp, "data", "plan.json"), "{ not json");
    expect(await GET().then((r) => r.json())).toBeNull();
  });

  it("reports a failed write instead of pretending it worked", async () => {
    const { PUT } = await loadRoute();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(fs, "writeFile").mockRejectedValueOnce(new Error("disk full"));
    const res = await PUT(put(makePlan()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });
});

describe("Postgres-backed storage (DATABASE_URL set)", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://localhost/test";
  });

  it("reads through the database, not the filesystem", async () => {
    const plan = makePlan();
    dbGetPlan.mockResolvedValue(plan);
    const { GET } = await loadRoute();
    expect(await GET().then((r) => r.json())).toEqual(plan);
    expect(dbGetPlan).toHaveBeenCalled();
  });

  it("writes through the database", async () => {
    dbPutPlan.mockResolvedValue(undefined);
    const { PUT } = await loadRoute();
    const plan = makePlan();
    await PUT(put(plan));
    expect(dbPutPlan).toHaveBeenCalledWith(plan);
    await expect(fs.stat(path.join(tmp, "data"))).rejects.toThrow();
  });

  it("surfaces a database read failure as a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbGetPlan.mockRejectedValue(new Error("connection refused"));
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toBeNull();
  });

  it("surfaces a database write failure as a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    dbPutPlan.mockRejectedValue(new Error("connection refused"));
    const { PUT } = await loadRoute();
    const res = await PUT(put(makePlan()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false });
  });
});
