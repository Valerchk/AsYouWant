/* ==========================================================================
   Ribbon geometry — minutes to pixels.
   --------------------------------------------------------------------------
   Pure, like the engine. Kept separate because the engine answers "what is
   true about this day" and this answers "how tall is it on screen", and the
   two change for entirely different reasons.

   The important consequence of collapsing empty stretches: vertical position
   is no longer proportional to time. Nothing may compute a y from a minute by
   multiplying — use yForMinute(), which walks the segments.
   ========================================================================== */

import type { Layout, PlacedBlock } from "./engine";

export const PX_PER_MIN = 1.5;
/** 44pt is Apple's minimum touch target. 56 leaves room for a second line and
    keeps short blocks from looking cramped against a light background, where
    tight spacing reads as stuck-together rather than dense. */
export const MIN_BLOCK_H = 56;
/** Empty stretches longer than this collapse to a labelled strip. */
export const GAP_COLLAPSE_FROM_MIN = 25;
export const COLLAPSED_GAP_H = 40;
export const MIN_GAP_H = 6;

export interface BlockSegment {
  type: "block";
  key: string;
  placed: PlacedBlock;
  top: number;
  height: number;
}

export interface GapSegment {
  type: "gap";
  key: string;
  startMin: number;
  endMin: number;
  top: number;
  height: number;
  /** True when the strip is shorter than the time it stands for. */
  collapsed: boolean;
}

export type Segment = BlockSegment | GapSegment;

export interface Geometry {
  segments: Segment[];
  totalHeight: number;
  startMin: number;
  endMin: number;
}

function blockHeight(minutes: number): number {
  return Math.max(MIN_BLOCK_H, Math.round(minutes * PX_PER_MIN));
}

function gapHeight(minutes: number): { height: number; collapsed: boolean } {
  if (minutes >= GAP_COLLAPSE_FROM_MIN) {
    return { height: COLLAPSED_GAP_H, collapsed: true };
  }
  return {
    height: Math.max(MIN_GAP_H, Math.round(minutes * PX_PER_MIN)),
    collapsed: false,
  };
}

export function buildGeometry(
  layout: Layout,
  dayStartMin: number,
  dayEndMin: number,
): Geometry {
  const placed = layout.placed;

  // The ribbon spans the planned day, widened if anything spills past either
  // edge — a block that ran before the day "started" is still part of it.
  const firstBlockMin = placed.length ? placed[0].startMin : dayStartMin;
  const lastBlockMin = placed.length
    ? Math.max(...placed.map((p) => p.endMin))
    : dayEndMin;

  const startMin = Math.min(dayStartMin, firstBlockMin);
  const endMin = Math.max(dayEndMin, lastBlockMin);

  const segments: Segment[] = [];
  let top = 0;
  let cursor = startMin;

  const pushGap = (from: number, to: number) => {
    const minutes = to - from;
    if (minutes <= 0) return;
    const { height, collapsed } = gapHeight(minutes);
    segments.push({
      type: "gap",
      key: `gap-${from}-${to}`,
      startMin: from,
      endMin: to,
      top,
      height,
      collapsed,
    });
    top += height;
  };

  for (const p of placed) {
    // Overlapping blocks would otherwise emit a negative gap. Overlaps are
    // possible in real data: a running block can overrun into an anchor.
    if (p.startMin > cursor) pushGap(cursor, p.startMin);

    const height = blockHeight(p.endMin - p.startMin);
    segments.push({
      type: "block",
      key: p.block.id,
      placed: p,
      top,
      height,
    });
    top += height;
    cursor = Math.max(cursor, p.endMin);
  }

  if (cursor < endMin) pushGap(cursor, endMin);

  return { segments, totalHeight: top, startMin, endMin };
}

/**
 * Vertical position of a moment, interpolated inside whichever segment holds
 * it. This is the only correct way to place the now-line: a collapsed gap
 * represents far more time than its height, so arithmetic on minutes alone
 * would drift the line by hours over a sparse day.
 */
export function yForMinute(geo: Geometry, min: number): number {
  if (min <= geo.startMin) return 0;
  if (min >= geo.endMin) return geo.totalHeight;

  for (const s of geo.segments) {
    const from = s.type === "block" ? s.placed.startMin : s.startMin;
    const to = s.type === "block" ? s.placed.endMin : s.endMin;
    if (min < from) return s.top;
    if (min <= to) {
      const span = to - from;
      const progress = span === 0 ? 0 : (min - from) / span;
      return s.top + progress * s.height;
    }
  }
  return geo.totalHeight;
}
