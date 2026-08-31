import { describe, it, expect } from "vitest";
import { carriedCopy, closeBlock, pauseBlock, startBlock } from "./actions";
import { layout, type Block } from "./engine";

const H = (h: number, m = 0) => h * 60 + m;

const block = (over: Partial<Block> = {}): Block => ({
  id: "b1",
  title: "Block",
  kind: "flow",
  startMin: null,
  plannedMin: 45,
  status: "planned",
  sortOrder: 1,
  threadId: null,
  actualStartMin: null,
  actualEndMin: null,
  ...over,
});

describe("closing a block", () => {
  it("gives a block that has not started yet its full planned length", () => {
    // The bug this exists to prevent: closing a block scheduled for later
    // measured "start until now", clamped to zero, and reported the whole
    // block as time handed back — "+45m free" from a 45-minute block.
    const closed = closeBlock(block({ plannedMin: 45 }), H(14, 30), H(9, 26));

    expect(closed.actualStartMin).toBe(H(14, 30));
    expect(closed.actualEndMin).toBe(H(15, 15));
    expect(closed.actualEndMin! - closed.actualStartMin!).toBe(45);
  });

  it("reports no slack for a block closed before it began", () => {
    const closed = closeBlock(block({ plannedMin: 45 }), H(14, 30), H(9, 26));
    const r = layout([closed], {
      nowMin: H(9, 26),
      dayStartMin: H(8),
      dayEndMin: H(22),
    });
    expect(r.slack).toEqual([]);
  });

  it("measures a running block from its start until now", () => {
    const closed = closeBlock(block({ plannedMin: 90 }), H(9), H(10, 12));
    expect(closed.actualEndMin! - closed.actualStartMin!).toBe(72);
  });

  it("reports the unused remainder of a running block as slack", () => {
    const closed = closeBlock(block({ plannedMin: 90 }), H(9), H(10, 12));
    const r = layout([closed], {
      nowMin: H(10, 12),
      dayStartMin: H(8),
      dayEndMin: H(22),
    });
    expect(r.slack).toEqual([{ afterId: closed.id, minutes: 18 }]);
  });

  it("never credits a block with more than it was given", () => {
    // Closed long after it should have ended: it took its planned time, and
    // we do not invent an overrun we have no evidence for.
    const closed = closeBlock(block({ plannedMin: 30 }), H(9), H(15));
    expect(closed.actualEndMin).toBe(H(9, 30));
  });

  it("never produces a zero-length block", () => {
    for (const now of [H(6), H(9), H(12), H(23, 59)]) {
      const closed = closeBlock(block({ plannedMin: 30 }), H(12), now);
      expect(closed.actualEndMin! - closed.actualStartMin!).toBeGreaterThan(0);
    }
  });
});

/* -------------------------------------------------------------------------- */

describe("starting a block", () => {
  it("marks it running from this minute", () => {
    const b = block({ plannedMin: 45 });
    const started = startBlock(b, H(10, 20));

    expect(started.status).toBe("active");
    expect(started.actualStartMin).toBe(H(10, 20));
    expect(started.actualEndMin).toBe(null);
  });

  it("is what makes running over observable at all", () => {
    // The hole this fixes: nothing in the app could set status "active", so
    // `layout.running` was always null, `overrunMin` was always zero, and the
    // notification about running long could never fire in production.
    const b = block({ plannedMin: 30 });
    const started = startBlock(b, H(10));

    const result = layout([started], {
      nowMin: H(10, 50),
      dayStartMin: H(8),
      dayEndMin: H(22),
    });

    expect(result.running?.block.id).toBe(b.id);
    expect(result.running?.overrunMin).toBe(20);
  });

  it("keeps the minutes a paused block genuinely got", () => {
    const running = startBlock(block({ plannedMin: 60 }), H(10));
    const paused = pauseBlock(running, H(10, 25));

    expect(paused.status).toBe("done");
    expect(paused.actualStartMin).toBe(H(10));
    expect(paused.actualEndMin).toBe(H(10, 25));
  });

  it("never records a pause as negative time", () => {
    const running = startBlock(block({ plannedMin: 60 }), H(10));
    // A clock that has gone backwards, or a stale render.
    expect(pauseBlock(running, H(9)).actualEndMin).toBe(H(10));
  });
});

describe("carrying a block to another day", () => {
  it("arrives whole and unstarted", () => {
    const b = block({
      plannedMin: 45,
      status: "active",
      actualStartMin: H(10),
      threadId: "t1",
    });
    const copy = carriedCopy(b);

    expect(copy.title).toBe(b.title);
    expect(copy.plannedMin).toBe(45);
    expect(copy.threadId).toBe("t1");
    expect(copy.status).toBe("planned");
    expect(copy.actualStartMin).toBe(null);
    expect(copy.actualEndMin).toBe(null);
  });

  it("drops the routine it came from", () => {
    // Otherwise the copy collides with the block that routine grows on the
    // day it lands on, and the database refuses one of the two.
    const copy = carriedCopy(block({ routineId: "r1" }));
    expect(copy.routineId).toBe(null);
  });
});
