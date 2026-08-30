import { describe, it, expect } from "vitest";
import { layout, type Block, type DayContext } from "./engine";

/* Times below are written as clock literals for readability: 9 * 60 is 09:00. */
const H = (h: number, m = 0) => h * 60 + m;

const DAY: DayContext = {
  nowMin: H(9),
  dayStartMin: H(8),
  dayEndMin: H(22),
};

let seq = 0;
function block(over: Partial<Block> = {}): Block {
  seq += 1;
  return {
    id: `b${seq}`,
    title: `block ${seq}`,
    kind: "flow",
    startMin: null,
    plannedMin: 60,
    status: "planned",
    sortOrder: seq,
    threadId: null,
    actualStartMin: null,
    actualEndMin: null,
    ...over,
  };
}

const anchor = (startMin: number, plannedMin: number, over: Partial<Block> = {}) =>
  block({ kind: "anchor", startMin, plannedMin, ...over });

const at = (r: ReturnType<typeof layout>, id: string) =>
  r.placed.find((p) => p.block.id === id);

/* -------------------------------------------------------------------------- */

describe("empty day", () => {
  it("places nothing and reports the whole remaining day as free", () => {
    const r = layout([], DAY);
    expect(r.placed).toEqual([]);
    expect(r.overflow).toEqual([]);
    expect(r.slack).toEqual([]);
    expect(r.running).toBeNull();
    // 09:00 → 22:00
    expect(r.freeMin).toBe(H(13));
  });

  it("measures free time from now, not from the day's start", () => {
    const r = layout([], { ...DAY, nowMin: H(20) });
    expect(r.freeMin).toBe(H(2));
  });
});

describe("anchors", () => {
  it("holds each anchor at exactly its time", () => {
    const a = anchor(H(10), 30);
    const b = anchor(H(14), 60);
    const r = layout([a, b], DAY);

    expect(at(r, a.id)).toMatchObject({ startMin: H(10), endMin: H(10, 30) });
    expect(at(r, b.id)).toMatchObject({ startMin: H(14), endMin: H(15) });
    expect(r.freeMin).toBe(H(13) - 90);
  });

  it("keeps two back-to-back anchors distinct rather than merging them", () => {
    const a = anchor(H(10), 60);
    const b = anchor(H(11), 60);
    const r = layout([a, b], DAY);

    expect(r.placed).toHaveLength(2);
    expect(at(r, a.id)!.endMin).toBe(at(r, b.id)!.startMin);
    expect(r.overflow).toEqual([]);
  });

  it("keeps a missed anchor in place and flags it", () => {
    // 09:00 meeting, still 'planned', and it is now 11:00.
    const missed = anchor(H(9), 60);
    const r = layout([missed], { ...DAY, nowMin: H(11) });

    expect(at(r, missed.id)).toMatchObject({
      startMin: H(9),
      isMissed: true,
    });
    // Free time is measured forward from now, so a fully past anchor neither
    // adds to it nor subtracts from it: 11:00 → 22:00.
    expect(r.freeMin).toBe(H(11));
  });

  it("counts only the remaining half of an anchor straddling now", () => {
    // 10:30–11:30 meeting, and it is 11:00: half an hour of it is still ahead.
    const straddling = anchor(H(10, 30), 60);
    const r = layout([straddling], { ...DAY, nowMin: H(11) });

    expect(at(r, straddling.id)!.isMissed).toBe(false);
    // 11:00 → 22:00 is 11h, minus the 30 minutes the meeting still owns.
    expect(r.freeMin).toBe(H(11) - 30);
  });

  it("does not report negative free time when an anchor outruns the day", () => {
    const late = anchor(H(21, 30), 90); // ends at 23:00, past a 22:00 day
    const r = layout([late], { ...DAY, nowMin: H(21, 30) });
    expect(r.freeMin).toBe(0);
  });

  it("places a flow block after an anchor that straddles now", () => {
    const straddling = anchor(H(10, 30), 60);
    const next = block({ plannedMin: 30, sortOrder: 9 });
    const r = layout([straddling, next], { ...DAY, nowMin: H(11) });

    expect(at(r, next.id)!.startMin).toBe(H(11, 30));
  });
});

describe("a day that is already over", () => {
  it("reports no free time and overflows every flow block", () => {
    const a = block({ plannedMin: 30 });
    const r = layout([a], { ...DAY, nowMin: H(23), dayEndMin: H(22) });

    expect(r.freeMin).toBe(0);
    expect(r.overflow.map((b) => b.id)).toEqual([a.id]);
    expect(r.placed).toEqual([]);
  });

  it("does not flag an anchor still ahead as missed", () => {
    const upcoming = anchor(H(14), 60);
    const r = layout([upcoming], DAY);
    expect(at(r, upcoming.id)!.isMissed).toBe(false);
  });
});

describe("flow blocks", () => {
  it("pours them from now, in the author's order", () => {
    const a = block({ plannedMin: 30, sortOrder: 1 });
    const b = block({ plannedMin: 45, sortOrder: 2 });
    const r = layout([a, b], DAY);

    expect(at(r, a.id)).toMatchObject({ startMin: H(9), endMin: H(9, 30) });
    expect(at(r, b.id)).toMatchObject({ startMin: H(9, 30), endMin: H(10, 15) });
  });

  it("starts at the day's start when now is still before it", () => {
    const a = block({ plannedMin: 30 });
    const r = layout([a], { ...DAY, nowMin: H(6) });
    expect(at(r, a.id)!.startMin).toBe(H(8));
  });

  it("skips past an anchor rather than splitting a block across it", () => {
    const meeting = anchor(H(10), 60);
    // 90 minutes cannot fit in the 09:00–10:00 gap, so it must land after.
    const deep = block({ plannedMin: 90, sortOrder: 5 });
    const r = layout([meeting, deep], DAY);

    expect(at(r, deep.id)).toMatchObject({ startMin: H(11), endMin: H(12, 30) });
  });

  it("fills a gap exactly when the block is precisely its size", () => {
    const meeting = anchor(H(10), 60);
    const exact = block({ plannedMin: 60, sortOrder: 5 });
    const r = layout([meeting, exact], DAY);
    expect(at(r, exact.id)).toMatchObject({ startMin: H(9), endMin: H(10) });
  });

  it("never lets a short block leapfrog a long one", () => {
    const meeting = anchor(H(10), 60);
    const long = block({ plannedMin: 90, sortOrder: 1 });
    const short = block({ plannedMin: 30, sortOrder: 2 });
    const r = layout([meeting, long, short], DAY);

    // `short` would fit 09:00–09:30, but the author put `long` first.
    expect(at(r, long.id)!.startMin).toBe(H(11));
    expect(at(r, short.id)!.startMin).toBe(H(12, 30));
  });

  it("sends what will not fit before the day ends to overflow", () => {
    const r = layout(
      [
        block({ plannedMin: 60, sortOrder: 1 }),
        block({ plannedMin: 60, sortOrder: 2 }),
      ],
      { ...DAY, nowMin: H(20), dayEndMin: H(21) },
    );

    expect(r.placed).toHaveLength(1);
    expect(r.overflow).toHaveLength(1);
    expect(r.overflow[0].sortOrder).toBe(2);
  });

  it("keeps trying later blocks after one overflows", () => {
    const huge = block({ plannedMin: 300, sortOrder: 1 });
    const small = block({ plannedMin: 30, sortOrder: 2 });
    const r = layout([huge, small], { ...DAY, nowMin: H(20), dayEndMin: H(21) });

    expect(r.overflow.map((b) => b.id)).toEqual([huge.id]);
    expect(at(r, small.id)).toMatchObject({ startMin: H(20) });
  });
});

describe("finishing early", () => {
  it("reports the returned minutes as slack", () => {
    // Planned 90, actually took 72.
    const done = block({
      plannedMin: 90,
      status: "done",
      actualStartMin: H(9),
      actualEndMin: H(10, 12),
    });
    const r = layout([done], { ...DAY, nowMin: H(10, 12) });

    expect(r.slack).toEqual([{ afterId: done.id, minutes: 18 }]);
  });

  it("pulls the rest of the day up into the freed time", () => {
    const done = block({
      plannedMin: 90,
      sortOrder: 1,
      status: "done",
      actualStartMin: H(9),
      actualEndMin: H(10, 12),
    });
    const next = block({ plannedMin: 60, sortOrder: 2 });
    const r = layout([done, next], { ...DAY, nowMin: H(10, 12) });

    // Not 10:30, which is where the original plan would have put it.
    expect(at(r, next.id)!.startMin).toBe(H(10, 12));
  });

  it("reports no slack when a block runs exactly to plan", () => {
    const done = block({
      plannedMin: 60,
      status: "done",
      actualStartMin: H(9),
      actualEndMin: H(10),
    });
    const r = layout([done], { ...DAY, nowMin: H(10) });
    expect(r.slack).toEqual([]);
  });

  it("reports no slack when a finished block ran long", () => {
    const done = block({
      plannedMin: 60,
      status: "done",
      actualStartMin: H(9),
      actualEndMin: H(10, 30),
    });
    const r = layout([done], { ...DAY, nowMin: H(10, 30) });
    expect(r.slack).toEqual([]);
  });
});

describe("the running block", () => {
  it("is reported as running and holds its planned span", () => {
    const active = block({
      plannedMin: 90,
      status: "active",
      actualStartMin: H(9),
    });
    const r = layout([active], { ...DAY, nowMin: H(9, 40) });

    expect(r.running?.block.id).toBe(active.id);
    expect(r.running).toMatchObject({
      startMin: H(9),
      endMin: H(10, 30),
      overrunMin: 0,
    });
  });

  it("stretches past its plan and reports the overrun", () => {
    const active = block({
      plannedMin: 60,
      status: "active",
      actualStartMin: H(9),
    });
    const r = layout([active], { ...DAY, nowMin: H(10, 12) });

    expect(r.running).toMatchObject({ endMin: H(10, 12), overrunMin: 12 });
  });

  it("pushes the rest of the day down while it overruns", () => {
    const active = block({
      plannedMin: 60,
      sortOrder: 1,
      status: "active",
      actualStartMin: H(9),
    });
    const next = block({ plannedMin: 30, sortOrder: 2 });
    const r = layout([active, next], { ...DAY, nowMin: H(10, 12) });

    expect(at(r, next.id)!.startMin).toBe(H(10, 12));
  });

  it("can overrun a block straight into overflow at the end of the day", () => {
    const active = block({
      plannedMin: 30,
      sortOrder: 1,
      status: "active",
      actualStartMin: H(20),
    });
    const next = block({ plannedMin: 60, sortOrder: 2 });
    const r = layout([active, next], {
      ...DAY,
      nowMin: H(20, 40),
      dayEndMin: H(21),
    });

    expect(r.overflow.map((b) => b.id)).toEqual([next.id]);
  });
});

describe("blocks excluded from the day", () => {
  it("ignores dropped and carried blocks entirely", () => {
    const r = layout(
      [
        block({ status: "dropped", plannedMin: 60 }),
        block({ status: "carried", plannedMin: 60 }),
      ],
      DAY,
    );

    expect(r.placed).toEqual([]);
    expect(r.overflow).toEqual([]);
    expect(r.freeMin).toBe(H(13));
  });
});

describe("ordering of the result", () => {
  it("returns placed blocks in chronological order regardless of input", () => {
    const late = anchor(H(16), 30);
    const early = anchor(H(9, 30), 30);
    const mid = anchor(H(12), 30);
    const r = layout([late, early, mid], DAY);

    expect(r.placed.map((p) => p.block.id)).toEqual([early.id, mid.id, late.id]);
  });
});

describe("a realistic day", () => {
  it("reconciles history, a running overrun, anchors and overflow at once", () => {
    const morning = block({
      title: "thesis",
      plannedMin: 90,
      sortOrder: 1,
      status: "done",
      actualStartMin: H(9),
      actualEndMin: H(10, 12), // 18 minutes early
    });
    const standup = anchor(H(11), 30, { title: "standup" });
    const running = block({
      title: "review",
      plannedMin: 45,
      sortOrder: 2,
      status: "active",
      actualStartMin: H(10, 12),
    });
    const gym = block({ title: "gym", plannedMin: 60, sortOrder: 3 });
    const reading = block({ title: "reading", plannedMin: 60, sortOrder: 4 });

    // 11:05 — review has run 8 minutes long and collided with standup.
    const r = layout([morning, standup, running, gym, reading], {
      nowMin: H(11, 5),
      dayStartMin: H(8),
      dayEndMin: H(12, 30),
    });

    expect(r.slack).toEqual([{ afterId: morning.id, minutes: 18 }]);
    expect(r.running?.overrunMin).toBe(8);
    expect(at(r, standup.id)!.startMin).toBe(H(11));

    // Only 11:30–12:30 is left, so gym takes it and reading falls out.
    expect(at(r, gym.id)).toMatchObject({ startMin: H(11, 30) });
    expect(r.overflow.map((b) => b.id)).toEqual([reading.id]);
    expect(r.freeMin).toBe(0);
  });
});
