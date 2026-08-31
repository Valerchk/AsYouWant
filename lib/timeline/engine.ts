/* ==========================================================================
   The ribbon engine.
   --------------------------------------------------------------------------
   Pure. No database, no React, no clock of its own — `nowMin` is always
   passed in. Everything the product claims about a day is decided here, so
   this file is the one that must never be wrong.
   ========================================================================== */

import { MINUTES_IN_DAY } from "@/lib/time";

export type BlockKind = "anchor" | "flow";
export type BlockStatus =
  | "planned"
  | "active"
  | "done"
  | "dropped"
  | "carried";

export interface Block {
  id: string;
  title: string;
  kind: BlockKind;
  /** Anchors require a time. Flow blocks carry null and are placed by the engine. */
  startMin: number | null;
  plannedMin: number;
  status: BlockStatus;
  /** Author's intended order among flow blocks. Never reordered by the engine. */
  sortOrder: number;
  threadId: string | null;
  /** Set once the block actually runs. Minutes from local midnight. */
  actualStartMin: number | null;
  actualEndMin: number | null;
  /** The routine that grew this block, if any. */
  routineId?: string | null;
  /**
   * Comes from a subscribed calendar rather than from this app.
   *
   * The engine treats it as an ordinary anchor — it occupies its hour, and
   * free time has to account for it or the ribbon lies. Everything above the
   * engine refuses to edit it: it is somebody else's record of your day.
   */
  external?: boolean;
}

export interface PlacedBlock {
  block: Block;
  startMin: number;
  endMin: number;
  /** The block currently running. At most one per day. */
  isRunning: boolean;
  /** Wholly in the past and never started — a missed anchor. */
  isMissed: boolean;
  /** Minutes the running block has spent beyond its planned length. */
  overrunMin: number;
}

export interface Slack {
  /** The block whose early finish handed these minutes back. */
  afterId: string;
  minutes: number;
}

export interface Layout {
  placed: PlacedBlock[];
  /** Flow blocks with no room left before the day ends. */
  overflow: Block[];
  slack: Slack[];
  running: PlacedBlock | null;
  /** Unclaimed minutes between now and the end of the day. */
  freeMin: number;
}

export interface DayContext {
  nowMin: number;
  dayStartMin: number;
  dayEndMin: number;
}

interface Span {
  start: number;
  end: number;
}

/* -------------------------------------------------------------------------- */

/** Merge overlapping spans into a sorted, disjoint set. */
function mergeSpans(spans: Span[]): Span[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Span[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const next = sorted[i];
    if (next.start <= last.end) {
      last.end = Math.max(last.end, next.end);
    } else {
      out.push({ ...next });
    }
  }
  return out;
}

/**
 * First moment at or after `from` where `duration` fits without touching any
 * occupied span, or null if the day runs out first.
 *
 * Blocks are never split. A 90-minute block does not become 30 + 60 across a
 * meeting: that is not what the person agreed to do.
 */
function findSlot(
  from: number,
  duration: number,
  occupied: Span[],
  dayEndMin: number,
): number | null {
  let cursor = from;
  for (const span of occupied) {
    if (span.end <= cursor) continue;
    // Gap ahead of this span.
    if (span.start - cursor >= duration) return cursor;
    cursor = Math.max(cursor, span.end);
  }
  return cursor + duration <= dayEndMin ? cursor : null;
}

/* -------------------------------------------------------------------------- */

export function layout(blocks: Block[], ctx: DayContext): Layout {
  const dayStartMin = Math.max(0, ctx.dayStartMin);
  const dayEndMin = Math.min(MINUTES_IN_DAY, ctx.dayEndMin);
  const nowMin = ctx.nowMin;

  // Dropped and carried blocks left this day on purpose.
  const live = blocks.filter(
    (b) => b.status !== "dropped" && b.status !== "carried",
  );

  const placed: PlacedBlock[] = [];
  const occupied: Span[] = [];
  const slack: Slack[] = [];
  let running: PlacedBlock | null = null;

  /* --- 1. History. Finished blocks hold the time they actually took. ------ */
  for (const b of live) {
    if (b.status !== "done") continue;
    const start = b.actualStartMin ?? b.startMin ?? dayStartMin;
    const end = b.actualEndMin ?? start + b.plannedMin;
    placed.push({
      block: b,
      startMin: start,
      endMin: end,
      isRunning: false,
      isMissed: false,
      overrunMin: 0,
    });
    occupied.push({ start, end });

    // Finishing early is the moment the ribbon exists for: it hands minutes
    // back to the rest of the day, and the person should see the gift.
    const took = end - start;
    if (took < b.plannedMin) {
      slack.push({ afterId: b.id, minutes: b.plannedMin - took });
    }
  }

  /* --- 2. The running block. Stretches to now once it passes its plan. ---- */
  for (const b of live) {
    if (b.status !== "active") continue;
    const start = b.actualStartMin ?? b.startMin ?? nowMin;
    const plannedEnd = start + b.plannedMin;
    const end = Math.max(plannedEnd, nowMin);
    const entry: PlacedBlock = {
      block: b,
      startMin: start,
      endMin: end,
      isRunning: true,
      isMissed: false,
      overrunMin: Math.max(0, nowMin - plannedEnd),
    };
    placed.push(entry);
    occupied.push({ start, end });
    running = entry;
  }

  /* --- 3. Anchors. Pinned to their time, including ones already past. -----
     A missed 09:00 meeting is still a fact of the day at 10:00. Hiding it
     would make the ribbon agree with a day that did not happen. */
  for (const b of live) {
    if (b.status !== "planned" || b.kind !== "anchor") continue;
    const start = b.startMin ?? dayStartMin;
    const end = start + b.plannedMin;
    placed.push({
      block: b,
      startMin: start,
      endMin: end,
      isRunning: false,
      isMissed: end <= nowMin,
      overrunMin: 0,
    });
    occupied.push({ start, end });
  }

  /* --- 4. Flow. Poured into what is left, in the order the author set. ----
     The cursor only ever moves forward, so a short block can never leapfrog
     a long one just because it happens to fit an earlier gap. */
  const merged = mergeSpans(occupied);
  const flow = live
    .filter((b) => b.status === "planned" && b.kind === "flow")
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const overflow: Block[] = [];
  let cursor = Math.max(nowMin, dayStartMin);

  for (const b of flow) {
    const slot = findSlot(cursor, b.plannedMin, merged, dayEndMin);
    if (slot === null) {
      overflow.push(b);
      continue;
    }
    const end = slot + b.plannedMin;
    placed.push({
      block: b,
      startMin: slot,
      endMin: end,
      isRunning: false,
      isMissed: false,
      overrunMin: 0,
    });
    merged.push({ start: slot, end });
    merged.sort((x, y) => x.start - y.start);
    cursor = end;
  }

  /* --- 5. What is genuinely left of the day. ----------------------------- */
  const settled = mergeSpans(merged);
  let freeMin = 0;
  let scan = Math.max(nowMin, dayStartMin);
  for (const span of settled) {
    if (span.end <= scan) continue;
    if (span.start > scan) freeMin += Math.min(span.start, dayEndMin) - scan;
    scan = Math.max(scan, span.end);
    if (scan >= dayEndMin) break;
  }
  if (scan < dayEndMin) freeMin += dayEndMin - scan;

  placed.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  return { placed, overflow, slack, running, freeMin: Math.max(0, freeMin) };
}
