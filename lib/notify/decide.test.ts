import { describe, it, expect } from "vitest";
import { layout, type Block } from "@/lib/timeline/engine";
import { decideNotifications, currentBlock, type NotifyContext } from "./decide";
import { LIVE_TAG, RITUAL_TAG } from "./compose";

const H = (h: number, m = 0) => h * 60 + m;

let seq = 0;
function block(over: Partial<Block> = {}): Block {
  seq += 1;
  return {
    id: `b${seq}`,
    title: `Block ${seq}`,
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

const ctx = (over: Partial<NotifyContext> = {}): NotifyContext => ({
  nowMin: H(10),
  dayStartMin: H(8),
  dayEndMin: H(22),
  eveningReviewMin: H(21),
  dayConfirmed: true,
  ...over,
});

const NO_THREADS = new Map<string, string>();

const decide = (blocks: Block[], c: NotifyContext) =>
  decideNotifications(
    layout(blocks, {
      nowMin: c.nowMin,
      dayStartMin: c.dayStartMin,
      dayEndMin: c.dayEndMin,
    }),
    c,
    NO_THREADS,
  );

const byTag = (out: ReturnType<typeof decide>, tag: string) =>
  out.find((n) => n.tag === tag);

/* -------------------------------------------------------------------------- */

describe("silence", () => {
  it("says nothing before the day starts", () => {
    expect(decide([anchor(H(10), 60)], ctx({ nowMin: H(6) }))).toEqual([]);
  });
});

describe("consent", () => {
  it("only asks for confirmation while the day is unconfirmed", () => {
    const out = decide(
      [anchor(H(10), 60)],
      ctx({ nowMin: H(10, 20), dayConfirmed: false }),
    );

    expect(out).toHaveLength(1);
    expect(out[0].tag).toBe(RITUAL_TAG);
    // Crucially: no live card, no nudges. The app does not run a day nobody
    // agreed to.
    expect(byTag(out, LIVE_TAG)).toBeUndefined();
  });

  it("starts working the moment the day is confirmed", () => {
    const out = decide(
      [anchor(H(10), 60)],
      ctx({ nowMin: H(10, 20), dayConfirmed: true }),
    );
    expect(byTag(out, LIVE_TAG)).toBeDefined();
  });

  it("offers to plan when an unconfirmed day is empty", () => {
    const out = decide([], ctx({ dayConfirmed: false }));
    expect(out[0].title).toMatch(/nothing planned/i);
  });
});

describe("the live card", () => {
  it("tracks a block that is merely scheduled, not started", () => {
    // Nobody tapped "start" — which is most days — and the card must survive
    // that, or the headline feature disappears whenever life is normal.
    const b = anchor(H(10), 60, { title: "Lake walk" });
    const live = byTag(decide([b], ctx({ nowMin: H(10, 20) })), LIVE_TAG)!;

    // The title is only the block's name — iOS already prefixes the app's, so
    // a title carrying the countdown as well wrapped onto three lines.
    expect(live.title).toBe("Lake walk");
    expect(live.body).toContain("left");
    expect(live.silent).toBe(true);
  });

  it("reads the schedule, which is the only thing there is to read", () => {
    // There is no "started" state to prefer any more. Whatever the plan puts
    // across this minute is the current block, full stop.
    const earlier = anchor(H(9), 30, { title: "Earlier" });
    const nowish = anchor(H(10), 60, { title: "Now" });

    const result = layout([earlier, nowish] as Block[], {
      nowMin: H(10, 10),
      dayStartMin: H(8),
      dayEndMin: H(22),
    });
    expect(currentBlock(result, H(10, 10))?.block.title).toBe("Now");
  });

  it("disappears when nothing owns the moment", () => {
    const out = decide([anchor(H(14), 60)], ctx({ nowMin: H(10) }));
    expect(byTag(out, LIVE_TAG)).toBeUndefined();
  });

  it("never names the current block as the next one", () => {
    // The bug this exists to prevent, seen on a real lock screen:
    //   "Lake walk"  /  "1h 2m left · next Lake walk at 16:47"
    // A block starting exactly on the current minute satisfies both "owns
    // now" and "starts at or after now", so filtering by time alone put the
    // same block on both lines.
    const b = anchor(H(10), 60, { title: "Lake walk" });
    const live = byTag(decide([b], ctx({ nowMin: H(10) })), LIVE_TAG)!;

    expect(live.body).not.toContain("Lake walk");
    expect(live.body).toContain("last one today");
  });

  it("names a genuinely different block as next", () => {
    const now = anchor(H(10), 60, { title: "Lake walk" });
    const later = anchor(H(12), 30, { title: "Standup" });
    const live = byTag(decide([now, later], ctx({ nowMin: H(10, 20) })), LIVE_TAG)!;

    expect(live.body).toContain("Standup");
    expect(live.body).toContain("12:00");
  });

  it("carries the number of blocks still owed as the badge", () => {
    const out = decide(
      [anchor(H(10), 60), anchor(H(13), 30), anchor(H(15), 30)],
      ctx({ nowMin: H(10, 10) }),
    );
    expect(byTag(out, LIVE_TAG)!.appBadge).toBe(3);
  });
});

describe("not spamming the lock screen", () => {
  it("keeps the live card's text identical across a five-minute window", () => {
    // The scheduler runs every minute. If the copy changed every tick, the
    // deduplication hash would too, and APNs would carry sixty pushes an hour
    // for one card.
    const blocks = [anchor(H(10), 60)];
    const texts = new Set<string>();

    for (let m = H(10, 10); m < H(10, 15); m += 1) {
      const live = byTag(decide(blocks, ctx({ nowMin: m })), LIVE_TAG)!;
      texts.add(`${live.title}|${live.body}`);
    }

    expect(texts.size).toBe(1);
  });

  it("rewrites the card at most twelve times an hour", () => {
    // The real contract with APNs. One long block, ticked every minute for a
    // full hour: the number of distinct payloads is what actually gets sent.
    const blocks = [anchor(H(9), 180)];
    const texts = new Set<string>();

    for (let m = H(10); m < H(11); m += 1) {
      const live = byTag(decide(blocks, ctx({ nowMin: m })), LIVE_TAG)!;
      texts.add(`${live.title}|${live.body}`);
    }

    expect(texts.size).toBe(12);
  });

  it("does change the card as the block genuinely burns down", () => {
    const blocks = [anchor(H(10), 60)];
    const early = byTag(decide(blocks, ctx({ nowMin: H(10, 5) })), LIVE_TAG)!;
    const late = byTag(decide(blocks, ctx({ nowMin: H(10, 40) })), LIVE_TAG)!;

    // The name is constant; the countdown lives in the body.
    expect(early.title).toBe(late.title);
    expect(early.body).not.toBe(late.body);
  });
});

describe("starting soon", () => {
  it("speaks in the last ten minutes before something fixed begins", () => {
    const out = decide([anchor(H(11), 60)], ctx({ nowMin: H(10, 52) }));
    expect(out.some((n) => n.tag.startsWith("edge-soon-"))).toBe(true);
  });

  it("says the same thing for the whole warning window", () => {
    // The counting version produced a buzz a minute for ten minutes.
    const bodies = new Set<string>();
    for (let m = H(10, 50); m < H(11); m += 1) {
      const out = decide([anchor(H(11), 60)], ctx({ nowMin: m }));
      const soon = out.find((n) => n.tag.startsWith("edge-soon-"));
      if (soon) bodies.add(soon.body);
    }
    expect(bodies.size).toBe(1);
  });

  it("names the hour it will begin at", () => {
    const out = decide([anchor(H(11), 60)], ctx({ nowMin: H(10, 55) }));
    const soon = out.find((n) => n.tag.startsWith("edge-soon-"))!;
    expect(soon.body).toContain("11:00");
    expect(soon.silent).toBe(false);
  });

  it("stays quiet while the hour is still far off", () => {
    const out = decide([anchor(H(11), 60)], ctx({ nowMin: H(10, 20) }));
    expect(out.some((n) => n.tag.startsWith("edge-soon-"))).toBe(false);
  });

  it("says nothing about a block with no hour of its own", () => {
    // A flow block's start is an estimate the ribbon revises whenever
    // anything above it moves. Warning about a guess is how an app gets
    // silenced.
    const out = decide(
      [block({ plannedMin: 30, sortOrder: 1 })],
      ctx({ nowMin: H(10) }),
    );
    expect(out.some((n) => n.tag.startsWith("edge-soon-"))).toBe(false);
  });
});

describe("a missed anchor", () => {
  it("mentions it while it is still worth mentioning", () => {
    const out = decide([anchor(H(10), 30)], ctx({ nowMin: H(10, 45) }));
    const missed = out.find((n) => n.tag === "edge-missed")!;
    expect(missed.body).toContain("10:00");
    expect(missed.body).toMatch(/did it happen/i);
  });

  it("asks in the same words every minute it is asked", () => {
    // It used to count — "ended 3m ago", then "4m ago" — and every new
    // wording was a new message, so one missed meeting buzzed twenty times.
    const bodies = new Set<string>();
    for (let m = H(10, 32); m <= H(10, 48); m += 1) {
      const out = decide([anchor(H(10), 30)], ctx({ nowMin: m }));
      bodies.add(out.find((n) => n.tag === "edge-missed")!.body);
    }
    expect(bodies.size).toBe(1);
  });

  it("lets it go once the window has passed", () => {
    const out = decide([anchor(H(10), 30)], ctx({ nowMin: H(12) }));
    expect(out.some((n) => n.tag === "edge-missed")).toBe(false);
  });

  it("gathers several into one card rather than one buzz each", () => {
    // Three meetings missed over lunch used to be three notifications,
    // released one per throttle window — so the phone spoke about the past
    // three times, ten minutes apart.
    const out = decide(
      [
        // All three end inside the twenty-minute window.
        anchor(H(10, 45), 15, { title: "Standup" }),
        anchor(H(11), 10, { title: "Review" }),
        anchor(H(11, 10), 10, { title: "Call" }),
      ],
      ctx({ nowMin: H(11, 20) }),
    );

    const missed = out.filter((n) => n.tag === "edge-missed");
    expect(missed).toHaveLength(1);
    expect(missed[0].title).toBe("3 went past unmarked");
    expect(missed[0].body).toContain("Standup");
    expect(missed[0].body).toContain("Call");
  });
});

describe("the evening", () => {
  it("replaces everything with the day's cut", () => {
    const done = block({
      status: "done",
      threadId: "t1",
      actualStartMin: H(9),
      actualEndMin: H(11),
    });
    const out = decideNotifications(
      layout([done], { nowMin: H(21, 5), dayStartMin: H(8), dayEndMin: H(22) }),
      ctx({ nowMin: H(21, 5) }),
      new Map([["t1", "Thesis"]]),
    );

    expect(out).toHaveLength(1);
    expect(out[0].tag).toBe(RITUAL_TAG);
    expect(out[0].title).toMatch(/Thesis got 2h/);
    expect(out[0].navigate).toBe("/review");
  });

  it("is honest when nothing closed", () => {
    const out = decide([anchor(H(10), 60)], ctx({ nowMin: H(21, 5) }));
    expect(out[0].body).toMatch(/nothing closed/i);
  });
});
