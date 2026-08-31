import { describe, it, expect } from "vitest";
import { addDays, daysBetween, weekdayOf, weekOf, formatClock } from "./time";

describe("moving between days", () => {
  it("rolls over months and years", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("crosses a clock change without skipping or repeating a day", () => {
    // The mornings European clocks move. Adding 86 400 000 ms to a local Date
    // lands on the same calendar day on one of these and skips one on the
    // other, which is why the arithmetic goes through UTC.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("measures distance in both directions", () => {
    expect(daysBetween("2026-08-27", "2026-08-30")).toBe(3);
    expect(daysBetween("2026-08-30", "2026-08-27")).toBe(-3);
    expect(daysBetween("2026-08-27", "2026-08-27")).toBe(0);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("weekdays", () => {
  it("counts from Sunday, the way the routine mask does", () => {
    expect(weekdayOf("2026-08-30")).toBe(0);
    expect(weekdayOf("2026-08-03")).toBe(1);
    expect(weekdayOf("2026-08-27")).toBe(4);
  });

  it("builds the containing week Monday first", () => {
    const week = weekOf("2026-08-27");
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-08-24");
    expect(week[6]).toBe("2026-08-30");
    expect(week).toContain("2026-08-27");
  });

  it("puts Sunday at the end of its own week, not the start", () => {
    // The off-by-one that makes "this week" mean two different things.
    expect(weekOf("2026-08-30")[6]).toBe("2026-08-30");
    expect(weekOf("2026-08-30")[0]).toBe("2026-08-24");
  });
});

describe("formatClock", () => {
  it("pads so columns line up", () => {
    expect(formatClock(545)).toBe("09:05");
    expect(formatClock(0)).toBe("00:00");
  });
});
