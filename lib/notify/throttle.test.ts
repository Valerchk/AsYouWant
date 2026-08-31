import { describe, it, expect } from "vitest";
import { applyThrottle, mayInterrupt, GAP_MIN, HOURLY_CAP } from "./throttle";

const MIN = 60_000;
const NOW = 1_800_000_000_000;
const agoMin = (m: number) => ({ tag: "x", sentAt: NOW - m * MIN });

describe("how often the app may buzz", () => {
  it("allows the first interruption", () => {
    expect(mayInterrupt([], NOW)).toBe(true);
  });

  it("refuses a second one inside the gap", () => {
    // The reported symptom: four alerts in five minutes.
    expect(mayInterrupt([agoMin(1)], NOW)).toBe(false);
    expect(mayInterrupt([agoMin(GAP_MIN - 1)], NOW)).toBe(false);
  });

  it("allows one once the gap has passed", () => {
    expect(mayInterrupt([agoMin(GAP_MIN + 1)], NOW)).toBe(true);
  });

  it("stops at the hourly cap however well spaced", () => {
    const spaced = Array.from({ length: HOURLY_CAP }, (_, i) =>
      agoMin(10 + i * 10),
    );
    expect(mayInterrupt(spaced, NOW)).toBe(false);
  });

  it("forgets what happened more than an hour ago", () => {
    const old = Array.from({ length: HOURLY_CAP }, (_, i) => agoMin(61 + i));
    expect(mayInterrupt(old, NOW)).toBe(true);
  });

  it("treats a record from the future as just-sent rather than as licence", () => {
    expect(mayInterrupt([{ tag: "x", sentAt: NOW + 5 * MIN }], NOW)).toBe(false);
  });
});

describe("splitting a tick's payloads", () => {
  const loud = (tag: string) => ({ tag, silent: false });
  const quiet = { tag: "live", silent: true };

  it("never holds the silent card back", () => {
    const { send, held } = applyThrottle([quiet], [agoMin(0)], NOW);
    expect(send).toEqual([quiet]);
    expect(held).toEqual([]);
  });

  it("releases one audible notification per tick, not three", () => {
    const { send, held } = applyThrottle(
      [quiet, loud("a"), loud("b"), loud("c")],
      [],
      NOW,
    );
    expect(send).toHaveLength(2);
    expect(send).toContain(quiet);
    expect(held.map((p) => p.tag)).toEqual(["b", "c"]);
  });

  it("holds everything audible while inside the gap", () => {
    const { send, held } = applyThrottle(
      [quiet, loud("a")],
      [agoMin(1)],
      NOW,
    );
    expect(send).toEqual([quiet]);
    expect(held.map((p) => p.tag)).toEqual(["a"]);
  });
});
