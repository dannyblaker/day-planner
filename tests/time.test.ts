import {
  addDaysISO,
  fmtDateHuman,
  fmtDur,
  fmtTime,
  nowMinutes,
  parseTime,
  todayISO,
} from "@/lib/time";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.useRealTimers());

describe("parseTime", () => {
  it.each([
    ["9", 9 * 60],
    ["09", 9 * 60],
    ["9:30", 9 * 60 + 30],
    ["14:30", 14 * 60 + 30],
    ["2pm", 14 * 60],
    ["2PM", 14 * 60],
    ["2:15pm", 14 * 60 + 15],
    ["12pm", 12 * 60],
    ["12am", 0],
    ["12:30am", 30],
    ["0:00", 0],
    ["23:59", 23 * 60 + 59],
    [" 8am ", 8 * 60],
  ])("parses %j", (input, expected) => {
    expect(parseTime(input)).toBe(expected);
  });

  it.each([["24:00"], ["9:60"], ["nope"], [""], ["9:5"], ["25"], ["9pm30"]])(
    "rejects %j",
    (input) => {
      expect(parseTime(input)).toBeNull();
    }
  );
});

describe("fmtTime", () => {
  it("zero-pads and rounds to the minute", () => {
    expect(fmtTime(0)).toBe("00:00");
    expect(fmtTime(9 * 60 + 5)).toBe("09:05");
    expect(fmtTime(13 * 60 + 45.4)).toBe("13:45");
    expect(fmtTime(13 * 60 + 45.6)).toBe("13:46");
  });

  it("wraps past midnight, so an overrunning day still reads sensibly", () => {
    expect(fmtTime(24 * 60)).toBe("00:00");
    expect(fmtTime(25 * 60 + 30)).toBe("01:30");
  });
});

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

describe("addDaysISO", () => {
  it("moves forward and back", () => {
    expect(addDaysISO("2026-07-28", 1)).toBe("2026-07-29");
    expect(addDaysISO("2026-07-28", -1)).toBe("2026-07-27");
    expect(addDaysISO("2026-07-28", 0)).toBe("2026-07-28");
  });

  it("rolls over months and years", () => {
    expect(addDaysISO("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap days", () => {
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2027-02-28", 1)).toBe("2027-03-01");
  });
});

describe("todayISO / nowMinutes", () => {
  it("reads the local clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 28, 13, 45, 30));
    expect(todayISO()).toBe("2026-07-28");
    expect(nowMinutes()).toBeCloseTo(13 * 60 + 45.5, 5);
  });

  it("zero-pads single-digit months and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 0, 0, 0));
    expect(todayISO()).toBe("2026-01-05");
    expect(nowMinutes()).toBe(0);
  });
});

describe("fmtDateHuman", () => {
  it("renders the date in the middle of the day, so no timezone flips it", () => {
    // parsed at noon local: a UTC-shifted parse would show the 27th
    expect(fmtDateHuman("2026-07-28")).toContain("28");
    expect(fmtDateHuman("2026-07-28")).toMatch(/Tue/i);
  });
});
