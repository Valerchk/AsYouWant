/* ==========================================================================
   Ribbon geometry — minutes to pixels.
   --------------------------------------------------------------------------
   Pure, like the engine. Kept separate because the engine answers "what is
   true about this day" and this answers "how tall is it on screen", and the
   two change for entirely different reasons.

   The important consequence of collapsing stretches of time: vertical position
   is no longer proportional to time. Nothing may convert between the two by
   multiplying — use yForMinute() and minuteForY(), which walk the segments.
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
/** The single row that stands in for everything already over. */
export const PAST_STRIP_H = 44;

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

/** Everything already over, folded into one row. */
export interface PastSegment {
  type: "past";
  key: string;
  startMin: number;
  endMin: number;
  top: number;
  height: number;
  blocks: PlacedBlock[];
  doneCount: number;
  missedCount: number;
}

export type Segment = BlockSegment | GapSegment | PastSegment;

export interface Geometry {
  segments: Segment[];
  totalHeight: number;
  startMin: number;
  endMin: number;
}

export interface GeometryOptions {
  /** Required for collapsePast; ignored otherwise. */
  nowMin?: number;
  /** Fold everything finished before `nowMin` into a single row. */
  collapsePast?: boolean;
}

/** The minutes a segment stands for — the same question for all three kinds. */
export function segmentStart(s: Segment): number {
  return s.type === "block" ? s.placed.startMin : s.startMin;
}

export function segmentEnd(s: Segment): number {
  return s.type === "block" ? s.placed.endMin : s.endMin;
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

/**
 * Fold the leading run of already-finished segments into one row.
 *
 * Opening a planner at six in the evening should not mean scrolling past ten
 * hours that have already happened — and, worse, being offered the chance to
 * schedule something at eight this morning. The past stays reachable behind
 * one tap; it just stops dominating the screen.
 */
function collapseLeadingPast(
  segments: Segment[],
  nowMin: number,
): Segment[] {
  let cut = 0;
  while (cut < segments.length && segmentEnd(segments[cut]) <= nowMin) cut++;
  if (cut === 0) return segments;

  const hidden = segments.slice(0, cut);
  const hiddenHeight = hidden.reduce((sum, s) => sum + s.height, 0);

  // Folding has to earn itself. Replacing one 56px block with a 44px strip
  // trades away what the block said for twelve pixels — so the past only
  // folds once it would save at least a strip's worth of room.
  if (hiddenHeight < PAST_STRIP_H * 2) return segments;

  const blocks = hidden.flatMap((s) => (s.type === "block" ? [s.placed] : []));

  const past: PastSegment = {
    type: "past",
    key: "past",
    startMin: segmentStart(hidden[0]),
    endMin: segmentEnd(hidden[cut - 1]),
    top: 0,
    height: PAST_STRIP_H,
    blocks,
    doneCount: blocks.filter((p) => p.block.status === "done").length,
    missedCount: blocks.filter((p) => p.isMissed).length,
  };

  const shift = PAST_STRIP_H - hiddenHeight;
  return [past, ...segments.slice(cut).map((s) => ({ ...s, top: s.top + shift }))];
}

export function buildGeometry(
  layout: Layout,
  dayStartMin: number,
  dayEndMin: number,
  options: GeometryOptions = {},
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

  const built: Segment[] = [];
  let top = 0;
  let cursor = startMin;

  const pushGap = (from: number, to: number) => {
    const minutes = to - from;
    if (minutes <= 0) return;
    const { height, collapsed } = gapHeight(minutes);
    built.push({
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
    built.push({ type: "block", key: p.block.id, placed: p, top, height });
    top += height;
    cursor = Math.max(cursor, p.endMin);
  }

  if (cursor < endMin) pushGap(cursor, endMin);

  const segments =
    options.collapsePast && options.nowMin !== undefined
      ? collapseLeadingPast(built, options.nowMin)
      : built;

  const totalHeight = segments.reduce((sum, s) => sum + s.height, 0);

  return { segments, totalHeight, startMin, endMin };
}

/**
 * Vertical position of a moment, interpolated inside whichever segment holds
 * it. This is the only correct way to place the now-line: a collapsed stretch
 * stands for far more time than its height, so arithmetic on minutes alone
 * would drift the line by hours over a sparse day.
 */
export function yForMinute(geo: Geometry, min: number): number {
  if (min <= geo.startMin) return 0;
  if (min >= geo.endMin) return geo.totalHeight;

  for (const s of geo.segments) {
    const from = segmentStart(s);
    const to = segmentEnd(s);
    if (min < from) return s.top;
    if (min <= to) {
      const span = to - from;
      const progress = span === 0 ? 0 : (min - from) / span;
      return s.top + progress * s.height;
    }
  }
  return geo.totalHeight;
}

/**
 * The moment at a vertical position — the exact inverse of yForMinute inside
 * any one segment.
 *
 * Dragging a block needs this, and it cannot be derived by dividing by
 * PX_PER_MIN: a collapsed gap or a folded past squeezes hours into a few
 * dozen pixels, so the two directions must walk the same segments.
 */
export function minuteForY(geo: Geometry, y: number): number {
  if (y <= 0) return geo.startMin;
  if (y >= geo.totalHeight) return geo.endMin;

  for (const s of geo.segments) {
    if (y < s.top) return segmentStart(s);
    if (y <= s.top + s.height) {
      const from = segmentStart(s);
      const to = segmentEnd(s);
      const progress = s.height === 0 ? 0 : (y - s.top) / s.height;
      return from + progress * (to - from);
    }
  }
  return geo.endMin;
}
