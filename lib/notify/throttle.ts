/* ==========================================================================
   How often this app is allowed to buzz.
   --------------------------------------------------------------------------
   The composers are written not to repeat themselves, but a day is allowed to
   contain several genuinely different things worth saying, and they can fall
   within a minute of each other: a block ends, an anchor was missed, the next
   one is already running long. Three true statements, three buzzes, one
   pocket.

   So the number of interruptions is capped here, independently of what the
   copy says. Two rules, both deliberately blunt:

     · never two within GAP_MIN minutes of each other
     · never more than HOURLY_CAP in a rolling hour

   Nothing is discarded. A payload held back is simply not recorded as sent,
   so the next tick offers it again and it arrives once the gap has passed —
   late is a fair price, and it is the only honest thing to do with a message
   that was worth sending a minute ago.

   The silent live card is not subject to any of this. It never buzzes, and it
   is the whole reason the loud ones can afford to stay quiet.
   ========================================================================== */

/** Minutes that must pass between two audible notifications. */
export const GAP_MIN = 5;

/** The most audible notifications one hour may contain. */
export const HOURLY_CAP = 4;

export interface SentRecord {
  tag: string;
  /** Milliseconds since the epoch. */
  sentAt: number;
}

/**
 * May an audible notification be sent right now?
 *
 * `recent` is every audible send known for this person; anything older than
 * an hour is ignored, so the caller may pass the whole table.
 */
export function mayInterrupt(
  recent: SentRecord[],
  nowMs: number,
): boolean {
  let withinHour = 0;

  for (const record of recent) {
    const agoMin = (nowMs - record.sentAt) / 60_000;
    // A record from the future means a clock skew somewhere. Treat it as now
    // rather than as licence to send.
    if (agoMin < GAP_MIN) return false;
    if (agoMin < 60) withinHour += 1;
  }

  return withinHour < HOURLY_CAP;
}

/**
 * Split payloads into what may go now and what waits for a later tick.
 *
 * Only one audible notification is released per tick even when the budget
 * would allow more: two arriving in the same second are one buzz and one
 * thing you never read.
 */
export function applyThrottle<T extends { silent: boolean }>(
  payloads: T[],
  recent: SentRecord[],
  nowMs: number,
): { send: T[]; held: T[] } {
  const send: T[] = [];
  const held: T[] = [];
  let spent = false;

  for (const payload of payloads) {
    if (payload.silent) {
      send.push(payload);
      continue;
    }
    if (!spent && mayInterrupt(recent, nowMs)) {
      send.push(payload);
      spent = true;
    } else {
      held.push(payload);
    }
  }

  return { send, held };
}
