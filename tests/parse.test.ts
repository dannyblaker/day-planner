import { parseQuickAdd } from "@/lib/parse";
import { Goal } from "@/lib/types";
import { beforeEach, describe, expect, it } from "vitest";
import { makeTask, resetFactory } from "./factory";

const goals: Goal[] = [
  { id: "g1", name: "deep-work", color: "#818cf8" },
  { id: "g2", name: "admin", color: "#f59e0b" },
];

const parse = (input: string, tasks = [] as ReturnType<typeof makeTask>[]) =>
  parseQuickAdd(input, tasks, goals);

beforeEach(resetFactory);

describe("defaults", () => {
  it("is P3 and nothing else with no tokens", () => {
    expect(parse("Write the report")).toMatchObject({
      title: "Write the report",
      priority: 3,
      dependsOn: [],
      blocked: null,
      urgent: false,
    });
  });

  it("collapses whitespace and trims", () => {
    expect(parse("   Write   the    report  ").title).toBe("Write the report");
  });

  it("returns an empty title when the input is only tokens", () => {
    expect(parse("#deep-work !1").title).toBe("");
  });
});

/** The grammar has no duration in it, so anything shaped like one is a word. */
describe("tokens that only look like durations", () => {
  it.each(["45m", "45min", "2h", "2hr", "1h30", "1h30m", "0.5h"])(
    "keeps %s in the title",
    (token) => {
      expect(parse(`Task ${token}`).title).toBe(`Task ${token}`);
    }
  );

  it("leaves a bare number in the title too", () => {
    expect(parse("Review 5 PRs").title).toBe("Review 5 PRs");
  });
});

describe("priority", () => {
  it.each([1, 2, 3] as const)("reads !%d", (p) => {
    expect(parse(`Task !${p}`).priority).toBe(p);
  });

  it("ignores out-of-range priorities and keeps them as text", () => {
    expect(parse("Task !5")).toMatchObject({ priority: 3, title: "Task !5" });
    expect(parse("Task !0")).toMatchObject({ priority: 3, title: "Task !0" });
  });

  /** There are three levels, so `!4` names nothing and stays where it was typed. */
  it("keeps !4 in the title", () => {
    expect(parse("Task !4")).toMatchObject({ priority: 3, title: "Task !4" });
  });
});

/**
 * Nothing marks a task as the concurrent one: what runs at once is whatever the
 * graph says is startable, which is not a claim a token can make. `~` is a word.
 */
describe("the tilde, which marks nothing", () => {
  it("keeps ~ in the title", () => {
    expect(parse("CI run ~").title).toBe("CI run ~");
  });
});

describe("goals", () => {
  it("matches an existing goal case-insensitively and keeps its casing", () => {
    expect(parse("Task #DEEP-WORK").goalName).toBe("deep-work");
  });

  it("passes through an unknown goal name for the store to create", () => {
    expect(parse("Task #reading").goalName).toBe("reading");
  });

  it("treats a bare # as text", () => {
    const parsed = parse("Task #");
    expect(parsed.goalName).toBeUndefined();
    expect(parsed.title).toBe("Task #");
  });
});

describe("dependencies", () => {
  it("links to a task whose title starts with the query, case-insensitively", () => {
    const design = makeTask({ id: "d1", title: "Design the thing" });
    expect(parse("Build it >design", [design]).dependsOn).toEqual(["d1"]);
  });

  it("takes the first match when several titles share a prefix", () => {
    const a = makeTask({ id: "a", title: "Design one" });
    const b = makeTask({ id: "b", title: "Design two" });
    expect(parse("Build >design", [a, b]).dependsOn).toEqual(["a"]);
  });

  it("accumulates several dependencies", () => {
    const a = makeTask({ id: "a", title: "Alpha" });
    const b = makeTask({ id: "b", title: "Beta" });
    expect(parse("Ship >alpha >beta", [a, b]).dependsOn).toEqual(["a", "b"]);
  });

  it("keeps an unmatched >token as text rather than silently dropping it", () => {
    expect(parse("Build it >nothing")).toMatchObject({
      dependsOn: [],
      title: "Build it >nothing",
    });
  });
});

describe("flags", () => {
  it("marks urgent with ^", () => {
    expect(parse("Hotfix ^")).toMatchObject({ urgent: true, title: "Hotfix" });
  });

  it("reads *reason as blocked, with dashes as spaces", () => {
    expect(parse("Ship *waiting-on-legal").blocked).toBe("waiting on legal");
  });

  it("falls back to a generic reason for a bare *", () => {
    expect(parse("Ship *").blocked).toBe("Blocked");
  });
});

describe("combinations", () => {
  it("parses the documented example", () => {
    const deploy = makeTask({ id: "dep", title: "Deploy pipeline" });
    expect(parse("Fix login bug !1 #deep-work >deploy ^", [deploy])).toEqual({
      title: "Fix login bug",
      priority: 1,
      goalName: "deep-work",
      dependsOn: ["dep"],
      blocked: null,
      urgent: true,
    });
  });

  it("does not care about token order", () => {
    const a = parse("!1 #admin ^ Laundry");
    const b = parse("Laundry ^ #admin !1");
    expect(a).toEqual({ ...b, title: "Laundry" });
  });
});
