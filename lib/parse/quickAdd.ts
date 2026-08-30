/* ==========================================================================
   Quick-add parser.
   --------------------------------------------------------------------------
   Regexes, not a model. This runs on every keystroke to drive the live
   preview, so it has to be instant and work with no network — and it has to
   be predictable, because the person is reading its output as they type.

     "thesis 90m 9am #study" → 09:00, 90 min, thread "study", anchored
     "email 20m"             → no time, 20 min, flow

   Deliberately not clever: a bare hour is read as 24-hour time, so `at 9`
   is 09:00 and `at 21` is 21:00. Guessing "they probably meant 9pm" from
   the current time is the kind of hidden behaviour that makes people stop
   trusting the field. The live preview shows the reading instead.
   ========================================================================== */

export type ParsedKind = "anchor" | "flow";

export interface ParsedBlock {
  title: string;
  plannedMin: number;
  /** Minutes from midnight, or null when no time was given (a flow block). */
  startMin: number | null;
  threadName: string | null;
  kind: ParsedKind;
}

export interface ParseToken {
  start: number;
  end: number;
  type: "duration" | "time" | "thread";
}

export interface ParseResult {
  parsed: ParsedBlock;
  /** Source ranges, for highlighting the recognised parts in the input. */
  tokens: ParseToken[];
}

/** Used when the person names no length. Long enough to mean something,
    short enough that nobody feels tricked into a commitment. */
export const DEFAULT_DURATION_MIN = 30;

const MAX_DURATION_MIN = 24 * 60;

/* Order matters: the first pattern to claim a range wins, so the more
   specific forms are listed above the ones that could swallow them. */

/* The optional `at `/`@` prefix on the time patterns is not decoration: it
   makes the preposition part of the claimed range, so "gym at 18:40" titles
   the block "gym" rather than "gym at". */

// 1h, 1h30, 1h30m, 1.5h — the trailing `m` only ever consumes the space that
// belongs to it, so "1h30 write" claims "1h30" and not "1h30 ".
const RE_HOURS = /\b(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hours?)\s*(\d{1,2})?(?:\s*m)?\b/i;
// 90m, 90min, 90 mins, 90 minutes
const RE_MINUTES = /\b(\d{1,4})\s*(?:m|min|mins|minutes?)\b/i;
// 9am, 9:30pm, 12 am, at 9pm
const RE_MERIDIEM = /(?:\bat\s+|@)?\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/i;
// 09:00, 18:40, 9.30, at 18:40
const RE_CLOCK = /(?:\bat\s+|@)?\b(\d{1,2})[:.](\d{2})\b/;
// at 9, at 21, @9
const RE_AT = /(?:\bat\s+|@)(\d{1,2})\b(?!\s*[:.]\d)/i;
// #study, #deep-work
const RE_THREAD = /#([\p{L}\p{N}_-]+)/u;

interface Claim {
  start: number;
  end: number;
  type: ParseToken["type"];
}

/** Find the first match that does not collide with an already-claimed range. */
function claim(
  input: string,
  re: RegExp,
  taken: Claim[],
): RegExpExecArray | null {
  const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = rx.exec(input)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    const overlaps = taken.some((t) => start < t.end && end > t.start);
    if (!overlaps) return m;
    if (m.index === rx.lastIndex) rx.lastIndex += 1;
  }
  return null;
}

function clampHour(h: number): number | null {
  return h >= 0 && h <= 23 ? h : null;
}

export function parseQuickAdd(input: string): ParseResult {
  const taken: Claim[] = [];
  let plannedMin: number | null = null;
  let startMin: number | null = null;
  let threadName: string | null = null;

  /* --- thread ------------------------------------------------------------ */
  const thread = claim(input, RE_THREAD, taken);
  if (thread) {
    threadName = thread[1];
    taken.push({
      start: thread.index,
      end: thread.index + thread[0].length,
      type: "thread",
    });
  }

  /* --- time: meridiem, then explicit clock, then bare `at N` ------------- */
  const meridiem = claim(input, RE_MERIDIEM, taken);
  if (meridiem) {
    let h = Number(meridiem[1]);
    const m = Number(meridiem[2] ?? 0);
    const pm = meridiem[3].toLowerCase() === "p";
    if (h >= 1 && h <= 12 && m <= 59) {
      if (h === 12) h = 0;
      startMin = (pm ? h + 12 : h) * 60 + m;
      taken.push({
        start: meridiem.index,
        end: meridiem.index + meridiem[0].length,
        type: "time",
      });
    }
  }

  if (startMin === null) {
    const clock = claim(input, RE_CLOCK, taken);
    if (clock) {
      const h = clampHour(Number(clock[1]));
      const m = Number(clock[2]);
      if (h !== null && m <= 59) {
        startMin = h * 60 + m;
        taken.push({
          start: clock.index,
          end: clock.index + clock[0].length,
          type: "time",
        });
      }
    }
  }

  if (startMin === null) {
    const bare = claim(input, RE_AT, taken);
    if (bare) {
      const h = clampHour(Number(bare[1]));
      if (h !== null) {
        startMin = h * 60;
        taken.push({
          start: bare.index,
          end: bare.index + bare[0].length,
          type: "time",
        });
      }
    }
  }

  /* --- duration: hours form first, since "1h30" contains a minutes-like tail */
  const hours = claim(input, RE_HOURS, taken);
  if (hours) {
    const whole = Number(hours[1].replace(",", "."));
    const extra = hours[2] ? Number(hours[2]) : 0;
    const total = Math.round(whole * 60 + extra);
    if (total > 0 && total <= MAX_DURATION_MIN && extra <= 59) {
      plannedMin = total;
      taken.push({
        start: hours.index,
        end: hours.index + hours[0].length,
        type: "duration",
      });
    }
  }

  if (plannedMin === null) {
    const mins = claim(input, RE_MINUTES, taken);
    if (mins) {
      const total = Number(mins[1]);
      if (total > 0 && total <= MAX_DURATION_MIN) {
        plannedMin = total;
        taken.push({
          start: mins.index,
          end: mins.index + mins[0].length,
          type: "duration",
        });
      }
    }
  }

  /* --- title: whatever the patterns did not claim ------------------------ */
  const ranges = [...taken].sort((a, b) => a.start - b.start);
  let title = "";
  let cursor = 0;
  for (const r of ranges) {
    title += input.slice(cursor, r.start);
    title += " ";
    cursor = r.end;
  }
  title += input.slice(cursor);

  return {
    parsed: {
      title: title.replace(/\s+/g, " ").trim(),
      plannedMin: plannedMin ?? DEFAULT_DURATION_MIN,
      startMin,
      threadName,
      kind: startMin === null ? "flow" : "anchor",
    },
    tokens: ranges.map(({ start, end, type }) => ({ start, end, type })),
  };
}
