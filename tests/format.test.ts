import { fmtDur } from "@/lib/format";
import { describe, expect, it } from "vitest";

describe("fmtDur", () => {
  it.each([
    [0, "0m"],
    [5, "5m"],
    [59, "59m"],
    [60, "1h"],
    [90, "1h 30m"],
    [125, "2h 5m"],
    [44.6, "45m"],
  ])("formats %d as %s", (mins, expected) => {
    expect(fmtDur(mins)).toBe(expected);
  });
});
