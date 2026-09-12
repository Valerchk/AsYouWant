/* ==========================================================================
   Notification copy.
   --------------------------------------------------------------------------
   Every word the app says on a lock screen lives here, because tone is the
   thing that decides whether these get read or switched off on day three.

   Every one of these is rare and spoken: something about to start, something
   that went past unmarked, the day opening and closing. Short, direct, second
   person. No motivational quotes, no exclamation marks, no praise for doing
   the minimum.

   There used to be a second register — a silent card under a fixed tag that
   rewrote itself every few minutes, the closest a web app can get to a Live
   Activity. It is gone, and it is worth saying why, because the idea was
   good. On an iPhone it did not replace itself: a photographed lock screen
   showed five of them stacked, five minutes apart, each with a different
   number of hours left. Twelve pushes an hour, all of them visible. A feature
   that only works where nobody uses the app is not a feature.
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

export const RITUAL_TAG = "ritual";

/** Warn this many minutes before something fixed is due to begin. */
export const STARTING_SOON_MIN = 10;

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
  return layout.placed.filter((p) => p.block.status === "planned").length;
}

/* ==========================================================================
   Why the noisy notifications carry no live number
   --------------------------------------------------------------------------
   The scheduler runs every minute and transmits a payload whenever its text
   differs from the last one sent under the same tag. A body reading "9m left"
   and then "8m left" is a different text, so a single warning produced a buzz
   a minute for its whole window.

   So these say the thing once, in words as true on the last minute of the
   window as on the first. Nothing here counts down any more; there is nowhere
   left for a countdown to live, and after the live card that is a relief.
   lib/notify/throttle.ts is the second line of defence, and does not trust
   this file to stay disciplined.
   ========================================================================== */

/**
 * Something fixed is about to begin.
 *
 * The lead, not a live remainder: it is what "soon" means here, it is true
 * within a minute of firing, and it never changes underneath — so the same
 * payload is computed every minute of the window and sent exactly once.
 */
export function composeStartingSoon(
  block: PlacedBlock,
  layout: Layout,
  leadMin: number,
): NotificationPayload {
  return {
    tag: `edge-soon-${block.block.id}`,
    title: block.block.title,
    body: `Starts at ${formatClock(block.startMin)}, in ${spoken(leadMin)}.`,
    navigate: "/today",
    appBadge: remainingCount(layout),
    silent: false,
  };
}

/**
 * Anchors that came and went without being marked either way.
 *
 * Takes the whole list rather than one at a time. Three meetings missed over
 * lunch used to be three separate notifications, released one per throttle
 * window, so the phone buzzed at half past, twenty to, and ten to — about
 * things that had all already happened. One card, one tag, one buzz.
 */
export function composeMissed(
  blocks: PlacedBlock[],
  layout: Layout,
): NotificationPayload {
  const first = blocks[0];

  if (blocks.length === 1) {
    return {
      tag: "edge-missed",
      title: first.block.title,
      // No "12 minutes ago": the question is the same at 3 minutes and at 19,
      // and counting made it a new message every time it was asked.
      body: `It was due at ${formatClock(first.startMin)}. Did it happen?`,
      navigate: "/today",
      appBadge: remainingCount(layout),
      silent: false,
    };
  }

  return {
    tag: "edge-missed",
    title: `${blocks.length} went past unmarked`,
    body: blocks
      .map((p) => `${p.block.title} ${formatClock(p.startMin)}`)
      .join(" · "),
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
