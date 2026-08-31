import { describe, it, expect } from "vitest";
import {
  describeRepeat,
  maskFor,
  repeatsOn,
  repeatsOnDay,
  toggleWeekday,
} from "./routines";

describe("the weekday mask", () => {
  it("selects and deselects one day at a time", () => {
    let mask = 0;
    mask = toggleWeekday(mask, 1);
    mask = toggleWeekday(mask, 3);

    expect(repeatsOn(mask, 1)).toBe(true);
    expect(repeatsOn(mask, 3)).toBe(true);
    expect(repeatsOn(mask, 2)).toBe(false);

    mask = toggleWeekday(mask, 1);
    expect(repeatsOn(mask, 1)).toBe(false);
  });

  it("answers for a calendar date", () => {
    // 27 Aug 2026 is a Thursday.
    expect(repeatsOnDay(maskFor(4), "2026-08-27")).toBe(true);
    expect(repeatsOnDay(maskFor(5), "2026-08-27")).toBe(false);
  });
});

describe("saying what a routine does", () => {
  it("names the shapes people actually pick", () => {
    expect(describeRepeat(0b1111111)).toBe("Every day");
    expect(describeRepeat(0b0111110)).toBe("Weekdays");
    expect(describeRepeat(0b1000001)).toBe("Weekends");
    expect(describeRepeat(0)).toBe("Never");
  });

  it("lists the rest Monday first", () => {
    const mask = maskFor(1) | maskFor(3) | maskFor(0);
    expect(describeRepeat(mask)).toBe("Mon, Wed, Sun");
  });
});
