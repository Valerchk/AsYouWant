import { describe, it, expect } from "vitest";
import {
  applyThrottle,
  mayInterrupt,
  GAP_MIN,
  DEFAULT_MAX_PER_DAY,
  type Budget,
} from "./throttle";

const NOW = Date.UTC(2026, 8, 12, 12, 0, 0);
const agoMin = (m: number) => NOW - m * 60_000;

const budget = (over: Partial<Budget> = {}): Budget => ({
  maxPerDay: DEFAULT_MAX_PER_DAY,
  usedToday: 0,
  lastSentAt: null,
  ...over,
});

describe("the day's allowance", () => {
  it("is three, which is what the person asked for", () => {
    expect(DEFAULT_MAX_PER_DAY).toBe(3);
  });

  it("keeps an hour and a half between two notifications", () => {
    // Ninety minutes came from a photographed lock screen, not a calculation:
    // four cards inside one hour was the old rule working as written.
    expect(GAP_MIN).toBe(90);
    expect(mayInterrupt(budget({ lastSentAt: agoMin(89) }), NOW)).toBe(false);
    expect(mayInterrupt(budget({ lastSentAt: agoMin(91) }), NOW)).toBe(true);
  });

  it("allows the first one of the day whatever the clock says", () => {
    expect(mayInterrupt(budget(), NOW)).toBe(true);
  });

  it("stops at the allowance however well spaced", () => {
    const spent = budget({ usedToday: 3, lastSentAt: agoMin(600) });
    expect(mayInterrupt(spent, NOW)).toBe(false);
  });

  it("says nothing at all when the allowance is zero", () => {
    expect(mayInterrupt(budget({ maxPerDay: 0 }), NOW)).toBe(false);
  });

  it("honours an allowance the person raised", () => {
    const five = budget({ maxPerDay: 5, usedToday: 3, lastSentAt: agoMin(200) });
    expect(mayInterrupt(five, NOW)).toBe(true);
  });

  it("treats a timestamp from the future as just-sent, not as licence", () => {
    expect(mayInterrupt(budget({ lastSentAt: NOW + 60_000 }), NOW)).toBe(false);
  });
});

describe("splitting a tick's payloads", () => {
  it("releases one and holds the rest, however much room there is", () => {
    // Three true things at once is still one buzz and two you never read.
    const { send, held } = applyThrottle(["a", "b", "c"], budget(), NOW);
    expect(send).toEqual(["a"]);
    expect(held).toEqual(["b", "c"]);
  });

  it("holds everything while inside the gap", () => {
    const { send, held } = applyThrottle(
      ["a", "b"],
      budget({ lastSentAt: agoMin(10) }),
      NOW,
    );
    expect(send).toEqual([]);
    expect(held).toEqual(["a", "b"]);
  });

  it("holds everything once the day is spent", () => {
    const { send, held } = applyThrottle(
      ["a"],
      budget({ usedToday: 3, lastSentAt: agoMin(500) }),
      NOW,
    );
    expect(send).toEqual([]);
    expect(held).toEqual(["a"]);
  });

  it("never drops what it holds — a later tick offers it again", () => {
    const first = applyThrottle(["a", "b"], budget({ lastSentAt: agoMin(10) }), NOW);
    expect(first.held).toHaveLength(2);

    const later = applyThrottle(first.held, budget({ lastSentAt: agoMin(120) }), NOW);
    expect(later.send).toEqual(["a"]);
  });
});
