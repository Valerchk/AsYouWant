import { describe, it, expect } from "vitest";
import { parseQuickAdd } from "./quickAdd";
import { durationToken, setDuration, setTime, stripThread } from "./edit";

/* The contract that matters is not the string these produce but the string
   the parser reads back out of them — a chip that writes something the parser
   then misreads is worse than no chip. */

const read = (s: string) => parseQuickAdd(s).parsed;

describe("durations a chip writes", () => {
  it("round-trips every length the composer offers", () => {
    for (const min of [15, 30, 45, 60, 90, 120]) {
      expect(read(`gym ${durationToken(min)}`).plannedMin).toBe(min);
    }
  });

  it("replaces the existing duration rather than adding a second", () => {
    const next = setDuration("gym 45m 18:00", 90);
    expect(read(next).plannedMin).toBe(90);
    expect(next).not.toMatch(/45m/);
    expect(read(next).startMin).toBe(18 * 60);
    expect(read(next).title).toBe("gym");
  });

  it("appends one when there is none", () => {
    expect(read(setDuration("gym", 30)).plannedMin).toBe(30);
  });

  it("leaves room to keep typing after the token", () => {
    // "45m" + "gym" with no gap parses as a title of "45mgym" and no duration.
    expect(setDuration("", 45)).toBe("45m ");
  });
});

describe("the time chip", () => {
  it("sets a time on a block that had none, anchoring it", () => {
    const next = setTime("gym 45m", 18 * 60 + 40);
    expect(read(next).startMin).toBe(18 * 60 + 40);
    expect(read(next).kind).toBe("anchor");
    expect(read(next).plannedMin).toBe(45);
  });

  it("clears a time back to a flowing block", () => {
    const next = setTime("gym 45m at 9", null);
    expect(read(next).startMin).toBe(null);
    expect(read(next).kind).toBe("flow");
    expect(read(next).title).toBe("gym");
  });

  it("replaces a time written in any of the accepted forms", () => {
    for (const written of ["gym 9am", "gym at 9", "gym 09:00"]) {
      expect(read(setTime(written, 21 * 60)).startMin).toBe(21 * 60);
    }
  });
});

describe("dropping a typed #tag", () => {
  it("removes it and closes the gap it leaves", () => {
    const next = stripThread("gym #sport 45m");
    expect(read(next).threadName).toBe(null);
    expect(read(next).title).toBe("gym");
    expect(next).not.toMatch(/ {2}/);
  });

  it("is a no-op when nothing was tagged", () => {
    expect(stripThread("gym 45m")).toBe("gym 45m");
  });
});
