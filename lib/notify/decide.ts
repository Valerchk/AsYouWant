/* ==========================================================================
   What should be on the lock screen this minute.
   --------------------------------------------------------------------------
   Pure. The scheduler calls this once a minute per user, compares each
   payload against the last one sent under the same tag, and only transmits
   what changed. Deduplication is not an optimisation here: without it the
   live card would be re-pushed sixty times an hour.
   ========================================================================== */

import type { Layout, PlacedBlock } from "@/lib/timeline/engine";
import {
  composeEvening,
  composeLive,
  composeMissed,
  composeMorning,
  composeStartingSoon,
  STARTING_SOON_MIN,
  type NotificationPayload,
} from "./compose";

export interface NotifyContext {
  nowMin: number;
  dayStartMin: number;
  dayEndMin: number;
  eveningReviewMin: number;
  /** False until the person has confirmed today's plan. */
  dayConfirmed: boolean;

  /* Preferences. Defaults match what used to be hard-coded, so an account
     that has never opened Settings behaves exactly as before. */
  /** The self-updating lock-screen card. */
  notifyLive?: boolean;
  /** Minutes before something fixed begins to speak up. 0 disables it. */
  notifyLeadMin?: number;
  /** Nothing is sent between these, whatever else is true. */
  quietFromMin?: number | null;
  quietToMin?: number | null;
  /** When false, reminders start without waiting for confirmation. */
  requireConfirm?: boolean;
}

/**
 * Quiet hours, which usually wrap past midnight — 22:00 to 07:00 is a range
 * that starts after it ends, so a plain `from <= now && now < to` is wrong
 * for exactly the hours people care most about.
 */
function inQuietHours(
  nowMin: number,
  from: number | null | undefined,
  to: number | null | undefined,
): boolean {
  if (from === null || from === undefined) return false;
  if (to === null || to === undefined) return false;
  return from <= to
    ? nowMin >= from && nowMin < to
    : nowMin >= from || nowMin < to;
}

/** How long a missed anchor stays worth mentioning. */
const MISSED_WINDOW_MIN = 20;

/* The live card's countdown is computed from a clock quantised to this step,
   so its text — and therefore its content hash — changes twelve times an hour
   instead of sixty.

   Note it is *now* that gets quantised, not the remaining minutes. Rounding a
   continuously shrinking remainder still changes on its own schedule, which
   can land a boundary in the middle of any given five-minute window; pinning
   it to an absolute grid makes the card settle between grid lines exactly. */
const COUNTDOWN_STEP_MIN = 5;

function gridNow(nowMin: number): number {
  return Math.floor(nowMin / COUNTDOWN_STEP_MIN) * COUNTDOWN_STEP_MIN;
}

/**
 * The block the plan puts you in right now.
 *
 * The schedule is the only source there is. It used to consult a "running"
 * block first, which existed only when someone had pressed Start — and the
 * fallback below carried nearly every day anyway.
 */
export function currentBlock(
  layout: Layout,
  nowMin: number,
): PlacedBlock | null {
  return (
    layout.placed.find(
      (p) =>
        p.block.status === "planned" &&
        p.startMin <= nowMin &&
        nowMin < p.endMin,
    ) ?? null
  );
}

export function decideNotifications(
  layout: Layout,
  ctx: NotifyContext,
  threadNames: Map<string, string>,
): NotificationPayload[] {
  const { nowMin, dayStartMin, eveningReviewMin, dayConfirmed } = ctx;
  const leadMin = ctx.notifyLeadMin ?? STARTING_SOON_MIN;
  const wantsLive = ctx.notifyLive ?? true;
  const needsConfirm = ctx.requireConfirm ?? true;

  // Outside waking hours the app says nothing at all.
  if (nowMin < dayStartMin) return [];

  // Quiet hours win over everything, including the evening review.
  if (inQuietHours(nowMin, ctx.quietFromMin, ctx.quietToMin)) return [];

  if (nowMin >= eveningReviewMin) {
    return [composeEvening(layout, threadNames)];
  }

  // The app does not order anyone around about a day they never agreed to.
  // Until the plan is confirmed, the only thing it may say is "confirm it" —
  // unless the person has turned that requirement off.
  if (needsConfirm && !dayConfirmed) {
    return [composeMorning(layout)];
  }

  const out: NotificationPayload[] = [];
  const current = currentBlock(layout, nowMin);

  if (current && wantsLive) {
    const settled = gridNow(nowMin);
    out.push(
      composeLive(current, layout, nowMin, Math.max(0, current.endMin - settled)),
    );
  }

  /* Something fixed about to begin. Anchors only: a flow block's start is an
     estimate the ribbon revises the moment anything above it moves, and a
     phone that buzzes about a guess is a phone that gets silenced. */
  if (leadMin > 0) {
    const soon = layout.placed.find(
      (p) =>
        p.block.kind === "anchor" &&
        p.block.status === "planned" &&
        p.startMin > nowMin &&
        p.startMin - nowMin <= leadMin,
    );
    if (soon) out.push(composeStartingSoon(soon, layout, leadMin));
  }

  // Anchors that came and went unmarked, gathered into one card. Measured
  // from the end, not the start: the useful question only arises once the
  // hour is over.
  const missed = layout.placed.filter(
    (p) =>
      p.block.kind === "anchor" &&
      p.isMissed &&
      nowMin - p.endMin >= 0 &&
      nowMin - p.endMin <= MISSED_WINDOW_MIN,
  );
  if (missed.length > 0) out.push(composeMissed(missed, layout));

  return out;
}
