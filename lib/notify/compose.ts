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
import { formatClock, formatDuration } from "@/lib/time";

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

function nextAfter(layout: Layout, afterMin: number): PlacedBlock | null {
  const upcoming = layout.placed
    .filter((p) => p.startMin >= afterMin && p.block.status === "planned")
    .sort((a, b) => a.startMin - b.startMin);
  return upcoming[0] ?? null;
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
  const upNext = nextAfter(layout, nowMin);
  const tail = upNext
    ? `then ${upNext.block.title} ${formatClock(upNext.startMin)}`
    : "nothing after this";

  const state =
    current.overrunMin > 0
      ? `${formatDuration(displayMin)} over`
      : `${formatDuration(displayMin)} left`;

  return {
    tag: LIVE_TAG,
    title: `${current.block.title} · ${state}`,
    body: tail,
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
    body: `You gave it ${formatDuration(block.block.plannedMin)}. Clock's running.`,
    navigate: "/today",
    appBadge: remainingCount(layout),
    silent: false,
  };
}

export function composeEndingSoon(
  block: PlacedBlock,
  layout: Layout,
  nowMin: number,
): NotificationPayload {
  const left = Math.max(0, block.endMin - nowMin);
  return {
    tag: `edge-soon-${block.block.id}`,
    title: `${formatDuration(left)} left`,
    body: `${block.block.title} — land the thought.`,
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

  return {
    tag: `edge-over-${block.block.id}`,
    title: `${formatDuration(block.overrunMin)} over on ${block.block.title}`,
    body: consequence,
    navigate: "/today",
    appBadge: remainingCount(layout),
    silent: false,
  };
}

/** An anchor that came and went without being marked either way. */
export function composeAnchorMissed(
  block: PlacedBlock,
  layout: Layout,
  nowMin: number,
): NotificationPayload {
  const since = Math.max(0, nowMin - block.endMin);
  return {
    tag: `edge-missed-${block.block.id}`,
    title: block.block.title,
    body: `Ended ${formatDuration(since)} ago. Did it happen?`,
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
    title: `${count} ${count === 1 ? "block" : "blocks"} · ${formatDuration(planned)}`,
    body: "Confirm the day and the reminders start.",
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
    ? `${threadNames.get(top[0]) ?? "Unthreaded"} got ${formatDuration(top[1])}`
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
