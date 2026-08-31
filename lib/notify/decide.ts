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
  composeAnchorMissed,
  composeEndingSoon,
  composeEvening,
  composeLive,
  composeMorning,
  composeOverrun,
  ENDING_SOON_MIN,
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
  /** Minutes before a block ends to speak up. 0 disables it. */
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
 * The block that owns this moment on the schedule — running if one is, else
 * whatever is timetabled across now.
 *
 * Deliberately not `layout.running` alone: the live card has to survive the
 * person forgetting to tap "start", which is most days.
 */
export function currentBlock(
  layout: Layout,
  nowMin: number,
): PlacedBlock | null {
  if (layout.running) return layout.running;
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
  const leadMin = ctx.notifyLeadMin ?? ENDING_SOON_MIN;
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

  if (current) {
    const settled = gridNow(nowMin);
    const display =
      current.overrunMin > 0
        ? Math.max(0, settled - (current.startMin + current.block.plannedMin))
        : Math.max(0, current.endMin - settled);

    if (wantsLive) {
      out.push(composeLive(current, layout, nowMin, display));
    }

    if (current.overrunMin > 0) {
      out.push(composeOverrun(current, layout));
    } else if (leadMin > 0) {
      const left = current.endMin - nowMin;
      if (left > 0 && left <= leadMin) {
        out.push(composeEndingSoon(current, layout, leadMin));
      }
    }
  }

  // An anchor that came and went unmarked. Measured from its end, not its
  // start: while it is still running it belongs to the live card above, and
  // the useful question only arises once it is over.
  for (const p of layout.placed) {
    if (p.block.kind !== "anchor" || !p.isMissed) continue;
    const since = nowMin - p.endMin;
    if (since >= 0 && since <= MISSED_WINDOW_MIN) {
      out.push(composeAnchorMissed(p, layout));
    }
  }

  return out;
}
