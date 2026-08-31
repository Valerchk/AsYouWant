/* ==========================================================================
   Notification copy.
   --------------------------------------------------------------------------
   Every word the app says on a lock screen lives here, because tone is the
   thing that decides whether these get read or switched off on day three.

   Two registers, chosen by context:

   · INSTRUMENT — the live notification. It sits on the lock screen for hours
     and rewrites itself every few minutes, so it is pure telemetry. Anything
     with a personality would grate by lunchtime.

   · SECOND — the rare moments: a block starting, running long, the day
     opening and closing. Short, direct, second person. No motivational
     quotes, no exclamation marks, no praise for doing the minimum.
   ========================================================================== */

import type { Layout, PlacedBlock } from "@/lib/timeline/engine";
import { formatClock } from "@/lib/time";

export interface NotificationPayload {
  /** Notifications sharing a tag replace one another instead of stacking. */
  tag: string;
  title: string;
  body: string;
  /** Path opened when tapped. */
  navigate: string;
  appBadge: number;
  /** Silent updates keep the lock-screen card current without buzzing. */
  silent: boolean;
}

export const LIVE_TAG = "live";
export const RITUAL_TAG = "ritual";

/** Warn this many minutes before a running block is due to end. */
export const ENDING_SOON_MIN = 10;

/**
 * The block after this one.
 *
 * `exceptId` is not optional in spirit: a block starting exactly on the
 * current minute satisfies both "owns now" and "starts at or after now", so
 * filtering purely by time produced cards reading "Lake walk · 1h left / then
 * Lake walk 16:47" — the same block, twice.
 */
function nextAfter(
  layout: Layout,
  afterMin: number,
  exceptId: string | null,
): PlacedBlock | null {
  const upcoming = layout.placed
    .filter(
      (p) =>
        p.block.id !== exceptId &&
        p.startMin >= afterMin &&
        p.block.status === "planned",
    )
    .sort((a, b) => a.startMin - b.startMin);
  return upcoming[0] ?? null;
}

/** "1h 2m", "45m", "2h" — for prose, where padded digits read as a clock. */
function spoken(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Blocks still owed today — the number on the app icon. */
export function remainingCount(layout: Layout): number {
  return layout.placed.filter(
    (p) => p.block.status === "planned" || p.block.status === "active",
  ).length;
}

/* --------------------------------------------------------------------------
   INSTRUMENT — the live card
   -------------------------------------------------------------------------- */

/**
 * The closest a PWA gets to a Live Activity: one notification, one tag,
 * rewritten in place as the block burns down.
 *
 * `displayMin` is passed in rather than derived, because the caller quantises
 * it so this card's text — and therefore its content hash — settles for
 * minutes at a time instead of changing on every scheduler tick.
 */
export function composeLive(
  current: PlacedBlock,
  layout: Layout,
  nowMin: number,
  displayMin: number,
): NotificationPayload {
  const upNext = nextAfter(layout, nowMin, current.block.id);

  // The title is the block, nothing else. iOS already prefixes the app name,
  // so a title carrying both name and countdown wrapped to three lines and
  // read as noise.
  const state =
    current.overrunMin > 0
      ? `${spoken(displayMin)} over`
      : `${spoken(displayMin)} left`;

  const body = upNext
    ? `${state} · next ${upNext.block.title} at ${formatClock(upNext.startMin)}`
    : `${state} · last one today`;

  return {
    tag: LIVE_TAG,
    title: current.block.title,
    body,
    navigate: "/today",
    appBadge: remainingCount(layout),
    silent: true,
  };
}

/* --------------------------------------------------------------------------
   SECOND — the rare, spoken moments
   -------------------------------------------------------------------------- */

export function composeBlockStarted(
  block: PlacedBlock,
  layout: Layout,
): NotificationPayload {
  return {
    tag: `edge-start-${block.block.id}`,
    title: block.block.title,
    body: `You gave it ${spoken(block.block.plannedMin)}. Clock's running.`,
    navigate: "/today",
    appBadge: remainingCount(layout),
    silent: false,
  };
}

/* ==========================================================================
   Why the noisy notifications carry no live number
   --------------------------------------------------------------------------
   The scheduler runs every minute and transmits a payload whenever its text
   differs from the last one sent under the same tag. A body reading "9m left"
   and then "8m left" is a different text, so a single block ending produced a
   buzz a minute for the whole warning window, and a block running long buzzed
   until it was closed. Four alerts in five minutes, exactly as reported.

   So these say the thing once and let the silent live card carry the count.
   Where a number genuinely has to escalate — running long — it moves in
   quarter-hour steps under an unchanged tag, which replaces the card on the
   lock screen instead of adding to it. lib/notify/throttle.ts is the second
   line of defence, and does not trust this file to stay disciplined.
   ========================================================================== */

/** How coarsely an escalating number is allowed to move. */
export const ESCALATION_STEP_MIN = 15;

export function composeEndingSoon(
  block: PlacedBlock,
  layout: Layout,
  leadMin: number,
): NotificationPayload {
  return {
    tag: `edge-soon-${block.block.id}`,
    title: block.block.title,
    // The lead, not the live remainder: it is what "soon" means here, it is
    // true within a minute of firing, and it never changes underneath.
    body: `${spoken(leadMin)} left. Land the thought.`,
    navigate: "/today",
    appBadge: remainingCount(layout),
    silent: false,
  };
}

export function composeOverrun(
  block: PlacedBlock,
  layout: Layout,
): NotificationPayload {
  const squeezed = layout.overflow.length;
  const consequence =
    squeezed > 0
      ? `${squeezed} ${squeezed === 1 ? "block" : "blocks"} no longer fit today.`
      : "Cut it here, or push the rest down?";

  // Quarter-hour steps. The tag is unchanged, so each new step replaces the
  // card rather than stacking a second one beside it.
  const step =
    Math.floor(block.overrunMin / ESCALATION_STEP_MIN) * ESCALATION_STEP_MIN;
  const over = step > 0 ? `${spoken(step)} over` : "Running over";

  return {
    tag: `edge-over-${block.block.id}`,
    title: block.block.title,
    body: `${over}. ${consequence}`,
    navigate: "/today",
    appBadge: remainingCount(layout),
    silent: false,
  };
}

/** An anchor that came and went without being marked either way. */
export function composeAnchorMissed(
  block: PlacedBlock,
  layout: Layout,
): NotificationPayload {
  return {
    tag: `edge-missed-${block.block.id}`,
    title: block.block.title,
    // No "12 minutes ago": the question is the same at 3 minutes and at 19,
    // and counting made it a new message every time it was asked.
    body: `It was due at ${formatClock(block.startMin)}. Did it happen?`,
    navigate: "/today",
    appBadge: remainingCount(layout),
    silent: false,
  };
}

/* --------------------------------------------------------------------------
   Rituals
   -------------------------------------------------------------------------- */

export function composeMorning(layout: Layout): NotificationPayload {
  const count = layout.placed.length;
  const planned = layout.placed.reduce(
    (sum, p) => sum + p.block.plannedMin,
    0,
  );

  if (count === 0) {
    return {
      tag: RITUAL_TAG,
      title: "Nothing planned yet",
      body: "Two minutes now saves the whole day.",
      navigate: "/today",
      appBadge: 0,
      silent: false,
    };
  }

  return {
    tag: RITUAL_TAG,
    title: "Today is drafted",
    body: `${count} ${count === 1 ? "block" : "blocks"}, ${spoken(planned)}. Confirm it and reminders start.`,
    navigate: "/today",
    appBadge: count,
    silent: false,
  };
}

export function composeEvening(
  layout: Layout,
  threadNames: Map<string, string>,
): NotificationPayload {
  const done = layout.placed.filter((p) => p.block.status === "done");

  if (done.length === 0) {
    return {
      tag: RITUAL_TAG,
      title: "Day's over",
      body: "Nothing closed today. Worth a look before tomorrow.",
      navigate: "/review",
      appBadge: 0,
      silent: false,
    };
  }

  // Where the time actually went — the thread that got the most of it.
  const perThread = new Map<string, number>();
  for (const p of done) {
    const id = p.block.threadId;
    if (!id) continue;
    perThread.set(id, (perThread.get(id) ?? 0) + (p.endMin - p.startMin));
  }

  const top = [...perThread.entries()].sort((a, b) => b[1] - a[1])[0];
  const headline = top
    ? `${threadNames.get(top[0]) ?? "Unthreaded"} got ${spoken(top[1])}`
    : `${done.length} ${done.length === 1 ? "block" : "blocks"} closed`;

  return {
    tag: RITUAL_TAG,
    title: headline,
    body: "See the cut of your day.",
    navigate: "/review",
    appBadge: 0,
    silent: false,
  };
}
