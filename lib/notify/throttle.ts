/* ==========================================================================
   How often this app is allowed to speak. At all.
   --------------------------------------------------------------------------
   The budget is a day, not an hour, and everything counts against it.

   It used to be a rolling hour — four an hour, one per ten minutes — and a
   lock screen photographed on a real phone settled the argument: the morning
   card had arrived four times inside one hour, which is not the rule failing
   but the rule working exactly as written. Fourteen waking hours at that rate
   is fifty-six notifications a day, for an app whose entire pitch is that it
   does not nag.

   So: a small whole number per day, chosen by the person, and an hour and a
   half between any two. Three is the default, and three a day is roughly
   "the morning, the one thing that mattered, and the evening".

   Nothing is discarded. A payload held back is simply not recorded as sent,
   so a later tick offers it again and it arrives once there is room — late is
   a fair price, and it is the only honest thing to do with a message that was
   worth sending an hour ago.
   ========================================================================== */

/** Minutes that must pass between two notifications. */
export const GAP_MIN = 90;

/** The day's allowance when nobody has said otherwise. */
export const DEFAULT_MAX_PER_DAY = 3;

/** What Settings offers. Zero means the app never speaks. */
export const MAX_PER_DAY_CHOICES = [0, 1, 2, 3, 5] as const;

export interface Budget {
  /** The person's allowance for one day. Zero silences the app entirely. */
  maxPerDay: number;
  /** How much of it today has already spent. */
  usedToday: number;
  /** Milliseconds since the epoch, or null when nothing has been sent. */
  lastSentAt: number | null;
}

/**
 * May a notification be sent right now?
 *
 * Two rules, both deliberately blunt, and either one is enough to refuse.
 */
export function mayInterrupt(budget: Budget, nowMs: number): boolean {
  if (budget.maxPerDay <= 0) return false;
  if (budget.usedToday >= budget.maxPerDay) return false;
  if (budget.lastSentAt === null) return true;

  const agoMin = (nowMs - budget.lastSentAt) / 60_000;
  // A timestamp from the future means a clock skew somewhere. Treat it as
  // just-sent rather than as licence to send.
  return agoMin >= GAP_MIN;
}

/**
 * Split payloads into what may go now and what waits for a later tick.
 *
 * Only one is released per tick even where the budget would allow more: two
 * arriving in the same second are one buzz and one thing you never read.
 */
export function applyThrottle<T>(
  payloads: T[],
  budget: Budget,
  nowMs: number,
): { send: T[]; held: T[] } {
  const send: T[] = [];
  const held: T[] = [];
  let spent = false;

  for (const payload of payloads) {
    if (!spent && mayInterrupt(budget, nowMs)) {
      send.push(payload);
      spent = true;
    } else {
      held.push(payload);
    }
  }

  return { send, held };
}
