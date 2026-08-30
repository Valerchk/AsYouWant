import { describe, it, expect } from "vitest";
import { layout, type Block } from "./engine";
import {
  buildGeometry,
  yForMinute,
  MIN_BLOCK_H,
  COLLAPSED_GAP_H,
  PX_PER_MIN,
  minuteForY,
  type Segment,
} from "./geometry";

const H = (h: number, m = 0) => h * 60 + m;

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
const anchor = (startMin: number, plannedMin: number) =>
  block({ kind: "anchor", startMin, plannedMin });

const geoOf = (blocks: Block[], nowMin = H(8)) =>
  buildGeometry(
    layout(blocks, { nowMin, dayStartMin: H(8), dayEndMin: H(22) }),
    H(8),
    H(22),
  );

const blocks = (segs: Segment[]) => segs.filter((s) => s.type === "block");
const gaps = (segs: Segment[]) => segs.filter((s) => s.type === "gap");

describe("segment stacking", () => {
  it("lays segments out contiguously with no overlap or gap", () => {
    const { segments, totalHeight } = geoOf([anchor(H(10), 60), anchor(H(14), 30)]);

    let expectedTop = 0;
    for (const s of segments) {
      expect(s.top).toBe(expectedTop);
      expectedTop += s.height;
    }
    expect(totalHeight).toBe(expectedTop);
  });

  it("never overlaps two segments, across a spread of days", () => {
    // The invariant the ribbon's correctness rests on: each segment starts
    // exactly where the previous one ended. When positions were carried by an
    // animated transform rather than by CSS, every segment collapsed onto the
    // same point and the overlapping hit areas swallowed taps — with the
    // geometry still perfectly correct, which is why this is asserted here.
    const days: Block[][] = [
      [],
      [anchor(H(10), 60)],
      [anchor(H(9), 30), anchor(H(9, 30), 30), anchor(H(10), 30)],
      [anchor(H(9), 60), anchor(H(17), 60)],
      [block({ plannedMin: 15 }), block({ plannedMin: 15 }), block({ plannedMin: 15 })],
      [
        block({
          plannedMin: 60,
          status: "active",
          actualStartMin: H(9),
        }),
        anchor(H(9, 30), 60),
      ],
      [
        block({
          plannedMin: 90,
          status: "done",
          actualStartMin: H(9),
          actualEndMin: H(10, 12),
        }),
        anchor(H(12), 30),
        block({ plannedMin: 45 }),
      ],
    ];

    for (const [i, blocks] of days.entries()) {
      const geo = geoOf(blocks, H(10, 30));
      let expectedTop = 0;
      for (const s of geo.segments) {
        expect(s.height, `day ${i}: zero-height segment`).toBeGreaterThan(0);
        expect(s.top, `day ${i}: segment does not follow the previous`).toBe(
          expectedTop,
        );
        expectedTop += s.height;
      }
      expect(geo.totalHeight, `day ${i}: total height`).toBe(expectedTop);
    }
  });

  it("gives a longer block more height than a shorter one", () => {
    const short = anchor(H(10), 30);
    const long = anchor(H(12), 120);
    const { segments } = geoOf([short, long]);

    const [a, b] = blocks(segments);
    expect(b.height).toBeGreaterThan(a.height);
    expect(b.height).toBe(120 * PX_PER_MIN);
  });

  it("never draws a block below the minimum touch target", () => {
    const tiny = anchor(H(10), 5);
    const { segments } = geoOf([tiny]);
    expect(blocks(segments)[0].height).toBe(MIN_BLOCK_H);
  });
});

describe("gaps", () => {
  it("collapses a long empty stretch to a fixed strip", () => {
    // 10:00–14:00 is four hours of nothing.
    const { segments } = geoOf([anchor(H(9), 60), anchor(H(14), 60)]);
    const between = gaps(segments).find((g) => g.startMin === H(10));

    expect(between).toBeDefined();
    expect(between!.collapsed).toBe(true);
    expect(between!.height).toBe(COLLAPSED_GAP_H);
  });

  it("keeps a short gap proportional rather than collapsing it", () => {
    // A 15-minute breather between two anchors.
    const { segments } = geoOf([anchor(H(10), 60), anchor(H(11, 15), 60)]);
    const between = gaps(segments).find((g) => g.startMin === H(11));

    expect(between).toBeDefined();
    expect(between!.collapsed).toBe(false);
    expect(between!.height).toBeLessThan(COLLAPSED_GAP_H);
  });

  it("emits no gap between back-to-back blocks", () => {
    const { segments } = geoOf([anchor(H(10), 60), anchor(H(11), 60)]);
    expect(gaps(segments).some((g) => g.startMin === H(11))).toBe(false);
  });

  it("emits no negative gap when a running block overruns into an anchor", () => {
    const running = block({
      plannedMin: 60,
      status: "active",
      actualStartMin: H(9),
    });
    const meeting = anchor(H(10), 60);
    const { segments } = geoOf([running, meeting], H(10, 30));

    for (const s of segments) expect(s.height).toBeGreaterThan(0);
  });

  it("collapses the long empty morning before the first block", () => {
    const { segments } = geoOf([anchor(H(15), 60)]);
    const first = segments[0];
    expect(first.type).toBe("gap");
    expect(first.top).toBe(0);
  });
});

describe("ribbon bounds", () => {
  it("spans the planned day when nothing exceeds it", () => {
    const geo = geoOf([anchor(H(10), 60)]);
    expect(geo.startMin).toBe(H(8));
    expect(geo.endMin).toBe(H(22));
  });

  it("widens to include a block that ran before the day started", () => {
    const early = block({
      plannedMin: 60,
      status: "done",
      actualStartMin: H(6, 30),
      actualEndMin: H(7, 30),
    });
    const geo = geoOf([early], H(8));
    expect(geo.startMin).toBe(H(6, 30));
  });

  it("widens to include a block running past the end of the day", () => {
    const geo = geoOf([anchor(H(21, 30), 90)]);
    expect(geo.endMin).toBe(H(23));
  });
});

describe("yForMinute", () => {
  it("pins the start and end of the ribbon", () => {
    const geo = geoOf([anchor(H(10), 60)]);
    expect(yForMinute(geo, H(8))).toBe(0);
    expect(yForMinute(geo, H(22))).toBe(geo.totalHeight);
  });

  it("clamps outside the ribbon rather than extrapolating", () => {
    const geo = geoOf([anchor(H(10), 60)]);
    expect(yForMinute(geo, H(3))).toBe(0);
    expect(yForMinute(geo, H(23, 59))).toBe(geo.totalHeight);
  });

  it("lands halfway down a block at its midpoint", () => {
    const a = anchor(H(10), 60);
    const geo = geoOf([a]);
    const seg = blocks(geo.segments)[0];

    expect(yForMinute(geo, H(10, 30))).toBeCloseTo(seg.top + seg.height / 2, 5);
  });

  it("increases monotonically across the whole day", () => {
    const geo = geoOf([anchor(H(9), 60), anchor(H(14), 30), anchor(H(19), 90)]);

    let previous = -1;
    for (let m = H(8); m <= H(22); m += 5) {
      const y = yForMinute(geo, m);
      expect(y).toBeGreaterThanOrEqual(previous);
      previous = y;
    }
  });

  it("stays inside a collapsed gap instead of drifting past it", () => {
    // Without interpolating per segment, 12:00 in a collapsed 10:00–14:00 gap
    // would be computed hours further down the ribbon than it belongs.
    const geo = geoOf([anchor(H(9), 60), anchor(H(14), 60)]);
    const gap = gaps(geo.segments).find((g) => g.startMin === H(10))!;
    const y = yForMinute(geo, H(12));

    expect(y).toBeGreaterThanOrEqual(gap.top);
    expect(y).toBeLessThanOrEqual(gap.top + gap.height);
  });
});

/* -------------------------------------------------------------------------- */

describe("folding the past", () => {
  const withPast = (blocks: Block[], nowMin: number) =>
    buildGeometry(
      layout(blocks, { nowMin, dayStartMin: H(8), dayEndMin: H(22) }),
      H(8),
      H(22),
      { nowMin, collapsePast: true },
    );

  it("replaces the finished run with one row", () => {
    // Two blocks done in the morning, opened at 18:00.
    const morning = [
      block({
        plannedMin: 60,
        status: "done",
        actualStartMin: H(9),
        actualEndMin: H(10),
      }),
      block({
        plannedMin: 60,
        status: "done",
        actualStartMin: H(10),
        actualEndMin: H(11),
      }),
      anchor(H(19), 60),
    ];

    const geo = withPast(morning, H(18));
    const past = geo.segments.find((s) => s.type === "past");

    expect(past).toBeDefined();
    expect(past!.type === "past" && past!.doneCount).toBe(2);
    // The two blocks and the gaps around them are now one short strip.
    expect(geo.segments.filter((s) => s.type === "block")).toHaveLength(1);
  });

  it("keeps segments contiguous after folding", () => {
    const geo = withPast(
      [
        block({
          plannedMin: 60,
          status: "done",
          actualStartMin: H(9),
          actualEndMin: H(10),
        }),
        anchor(H(19), 60),
      ],
      H(18),
    );

    let expectedTop = 0;
    for (const s of geo.segments) {
      expect(s.top).toBe(expectedTop);
      expectedTop += s.height;
    }
    expect(geo.totalHeight).toBe(expectedTop);
  });

  it("leaves a morning alone when nothing has finished yet", () => {
    const geo = withPast([anchor(H(10), 60)], H(9));
    expect(geo.segments.some((s) => s.type === "past")).toBe(false);
  });

  it("does not fold when folding would not save room", () => {
    // A single short gap is already smaller than the strip that would replace it.
    const geo = withPast([anchor(H(8), 10)], H(8, 12));
    expect(geo.segments.some((s) => s.type === "past")).toBe(false);
  });

  it("is off unless asked for", () => {
    const blocks = [
      block({
        plannedMin: 60,
        status: "done",
        actualStartMin: H(9),
        actualEndMin: H(10),
      }),
      anchor(H(19), 60),
    ];
    const geo = buildGeometry(
      layout(blocks, { nowMin: H(18), dayStartMin: H(8), dayEndMin: H(22) }),
      H(8),
      H(22),
    );
    expect(geo.segments.some((s) => s.type === "past")).toBe(false);
  });
});

describe("minuteForY", () => {
  it("is the exact inverse of yForMinute across the whole day", () => {
    // The property dragging depends on: drop a block at a pixel, get back the
    // minute that pixel stands for. Collapsed stretches make this non-linear,
    // so it cannot be checked by dividing by PX_PER_MIN.
    const geo = geoOf([anchor(H(9), 60), anchor(H(14), 30), anchor(H(19), 90)]);

    for (let m = H(8); m <= H(22); m += 7) {
      const round = minuteForY(geo, yForMinute(geo, m));
      expect(Math.abs(round - m)).toBeLessThan(0.5);
    }
  });

  it("survives the round trip with the past folded", () => {
    const geo = buildGeometry(
      layout([anchor(H(9), 60), anchor(H(19), 60)], {
        nowMin: H(18),
        dayStartMin: H(8),
        dayEndMin: H(22),
      }),
      H(8),
      H(22),
      { nowMin: H(18), collapsePast: true },
    );

    for (let m = H(18); m <= H(22); m += 5) {
      const round = minuteForY(geo, yForMinute(geo, m));
      expect(Math.abs(round - m)).toBeLessThan(0.5);
    }
  });

  it("clamps outside the ribbon", () => {
    const geo = geoOf([anchor(H(10), 60)]);
    expect(minuteForY(geo, -50)).toBe(geo.startMin);
    expect(minuteForY(geo, geo.totalHeight + 999)).toBe(geo.endMin);
  });
});
