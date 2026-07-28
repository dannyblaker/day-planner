import { parseQuickAdd } from "@/lib/parse";
import { Goal } from "@/lib/types";
import { beforeEach, describe, expect, it } from "vitest";
import { at, makeTask, resetFactory } from "./factory";

const goals: Goal[] = [
  { id: "g1", name: "deep-work", color: "#818cf8" },
  { id: "g2", name: "admin", color: "#f59e0b" },
];

const parse = (input: string, tasks = [] as ReturnType<typeof makeTask>[]) =>
  parseQuickAdd(input, tasks, goals);

beforeEach(resetFactory);

describe("defaults", () => {
  it("is 30 minutes at P3 with no tokens", () => {
    expect(parse("Write the report")).toMatchObject({
      title: "Write the report",
      duration: 30,
      priority: 3,
      dependsOn: [],
      parallel: false,
      blocked: null,
      urgent: false,
    });
  });

  it("collapses whitespace and trims", () => {
    expect(parse("   Write   the    report  ").title).toBe("Write the report");
  });

  it("returns an empty title when the input is only tokens", () => {
    expect(parse("45m !1").title).toBe("");
  });
});

describe("duration", () => {
  it.each([
    ["45m", 45],
    ["45min", 45],
    ["2h", 120],
    ["2hr", 120],
    ["1h30", 90],
    ["1h30m", 90],
    ["0.5h", 30],
    ["1.5h", 90],
  ])("reads %s as %d minutes", (token, expected) => {
    expect(parse(`Task ${token}`).duration).toBe(expected);
  });

  it("floors at 5 minutes", () => {
    expect(parse("Task 1m").duration).toBe(5);
    expect(parse("Task 0m").duration).toBe(5);
  });

  it("keeps the last duration when several are given", () => {
    expect(parse("Task 45m 2h").duration).toBe(120);
  });

  it("leaves a bare number in the title", () => {
    expect(parse("Review 5 PRs")).toMatchObject({
      title: "Review 5 PRs",
      duration: 30,
    });
  });
});

describe("priority", () => {
  it.each([1, 2, 3, 4] as const)("reads !%d", (p) => {
    expect(parse(`Task !${p}`).priority).toBe(p);
  });

  it("ignores out-of-range priorities and keeps them as text", () => {
    expect(parse("Task !5")).toMatchObject({ priority: 3, title: "Task !5" });
    expect(parse("Task !0")).toMatchObject({ priority: 3, title: "Task !0" });
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

describe("fixed start", () => {
  it.each([
    ["@2pm", at(14)],
    ["@14:30", at(14, 30)],
    ["@9", at(9)],
  ])("anchors %s", (token, expected) => {
    expect(parse(`Standup ${token}`).fixedStart).toBe(expected);
  });

  it("keeps an unparseable @token as part of the title", () => {
    const parsed = parse("Ping @bob");
    expect(parsed.fixedStart).toBeUndefined();
    expect(parsed.title).toBe("Ping @bob");
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
  it("marks parallel with ~", () => {
    expect(parse("CI run ~")).toMatchObject({ parallel: true, title: "CI run" });
  });

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
    expect(parse("Fix login bug 1h !1 #deep-work >deploy ^", [deploy])).toEqual({
      title: "Fix login bug",
      duration: 60,
      priority: 1,
      goalName: "deep-work",
      dependsOn: ["dep"],
      parallel: false,
      blocked: null,
      urgent: true,
    });
  });

  it("does not care about token order", () => {
    const a = parse("!1 45m #admin ~ Laundry");
    const b = parse("Laundry ~ #admin 45m !1");
    expect(a).toEqual({ ...b, title: "Laundry" });
  });
});
