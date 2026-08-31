/* ==========================================================================
   Reading a calendar subscription.
   --------------------------------------------------------------------------
   The ribbon used to claim three hours free while a meeting sat in Google
   Calendar at two o'clock. Free time that is not free is the one lie that
   makes a planner untrustworthy, so the day reads whatever calendar you point
   it at — one URL, read-only, never written back.

   Scope, stated plainly because the gaps matter more than the coverage:

     · handled — fixed events, DAILY and WEEKLY recurrence with INTERVAL,
       BYDAY, COUNT, UNTIL and EXDATE, floating times, UTC times, and named
       zones via TZID
     · skipped — all-day events, which consume no clock time and would
       otherwise swallow the whole ribbon
     · skipped — MONTHLY and YEARLY recurrence. Those are birthdays and
       anniversaries, which are all-day anyway

   Occurrences are computed for the requested day directly rather than by
   expanding a rule from its start: a standup that began in 2019 is three
   thousand iterations away, once per event, on every load.
   ========================================================================== */

export interface CalendarEvent {
  /** Stable per occurrence, so React keys and the engine agree across loads. */
  uid: string;
  title: string;
  /** Minutes from local midnight on the requested day. Clamped to the day. */
  startMin: number;
  endMin: number;
}

/** Refuse to parse an unreasonable feed rather than spending the request on it. */
export const MAX_ICS_BYTES = 4_000_000;
const MAX_EVENTS = 400;
const MINUTES_IN_DAY = 1440;

/* -------------------------------------------------------------------------- */
/* Time                                                                        */

/** Minutes to add to UTC to reach wall-clock time in `zone` at that instant. */
function offsetAt(utcMs: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));

  const at = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const asIfUtc = Date.UTC(
    at("year"),
    at("month") - 1,
    at("day"),
    at("hour"),
    at("minute"),
    at("second"),
  );
  return (asIfUtc - utcMs) / 60_000;
}

/**
 * A wall clock in a named zone → the instant it names.
 *
 * Inverting a zone offset needs the instant you are trying to find, so the
 * first guess uses the offset at the wrong moment and the second corrects it.
 * Two passes are exact everywhere except inside the hour a clock change
 * deletes, which names no instant at all.
 */
function wallToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  zone: string,
): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const once = guess - offsetAt(guess, zone) * 60_000;
  return guess - offsetAt(once, zone) * 60_000;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */

/** RFC 5545 folds long lines by starting the continuation with a space. */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .filter((line) => line.length > 0);
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): Property | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...rest] = head.split(";");

  const params: Record<string, string> = {};
  for (const part of rest) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }

  return { name: name.toUpperCase(), params, value };
}

/** Escaped text per RFC 5545: \n \, \; \\ */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

interface Stamp {
  /** UTC milliseconds. */
  ms: number;
  /** True for VALUE=DATE, which names a day rather than a moment. */
  allDay: boolean;
}

function parseStamp(prop: Property, zone: string): Stamp | null {
  const raw = prop.value.trim();

  // 20260827
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (dateOnly) {
    const [, y, mo, d] = dateOnly.map(Number);
    return { ms: Date.UTC(y, mo - 1, d), allDay: true };
  }

  // 20260827T100000 with optional trailing Z
  const stamp = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(raw);
  if (!stamp) return null;

  const y = Number(stamp[1]);
  const mo = Number(stamp[2]);
  const d = Number(stamp[3]);
  const h = Number(stamp[4]);
  const mi = Number(stamp[5]);
  const s = Number(stamp[6]);

  if (stamp[7] === "Z") {
    return { ms: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false };
  }

  // TZID names the event's own zone; without one the time is "floating" and
  // means whatever the clock on the wall says — which is the reader's zone.
  const named = prop.params.TZID;
  const inZone = named && isUsableZone(named) ? named : zone;
  return { ms: wallToUtc(y, mo, d, h, mi, s, inZone), allDay: false };
}

function isUsableZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** PT1H30M, P1D — only the parts a calendar actually emits for an event. */
function parseDuration(value: string): number | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value.trim(),
  );
  if (!m) return null;
  const [, d, h, mi, s] = m.map((x) => (x ? Number(x) : 0));
  const ms = ((d * 24 + h) * 60 + mi) * 60_000 + s * 1000;
  return ms > 0 ? ms : null;
}

/* -------------------------------------------------------------------------- */
/* Recurrence                                                                  */

interface Rule {
  freq: string;
  interval: number;
  byDay: number[];
  count: number | null;
  untilMs: number | null;
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function parseRule(value: string): Rule | null {
  const parts: Record<string, string> = {};
  for (const chunk of value.split(";")) {
    const eq = chunk.indexOf("=");
    if (eq > 0) parts[chunk.slice(0, eq).toUpperCase()] = chunk.slice(eq + 1);
  }
  if (!parts.FREQ) return null;

  const byDay = (parts.BYDAY ?? "")
    .split(",")
    .map((code) => DAY_CODES.indexOf(code.trim().slice(-2).toUpperCase()))
    .filter((i) => i >= 0);

  let untilMs: number | null = null;
  if (parts.UNTIL) {
    const stamp = parseStamp(
      { name: "UNTIL", params: {}, value: parts.UNTIL },
      "UTC",
    );
    untilMs = stamp?.ms ?? null;
  }

  return {
    freq: parts.FREQ.toUpperCase(),
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
    byDay,
    count: parts.COUNT ? Number(parts.COUNT) : null,
    untilMs,
  };
}

const DAY_MS = 86_400_000;

/** Whole days between two UTC-midnight instants. */
function dayDiff(fromMs: number, toMs: number): number {
  return Math.round((toMs - fromMs) / DAY_MS);
}

/** Midnight UTC of the calendar day an instant falls on, in `zone`. */
function utcMidnightOfLocalDay(ms: number, zone: string): number {
  const local = ms + offsetAt(ms, zone) * 60_000;
  return Math.floor(local / DAY_MS) * DAY_MS;
}

/**
 * Does the rule put an occurrence on `targetDayMs` (UTC midnight of the local
 * day), and if so, which ordinal is it? The ordinal is only computed because
 * COUNT needs it.
 */
function occurrenceOrdinal(
  rule: Rule,
  startDayMs: number,
  targetDayMs: number,
): number | null {
  const elapsed = dayDiff(startDayMs, targetDayMs);
  if (elapsed < 0) return null;

  if (rule.freq === "DAILY") {
    if (elapsed % rule.interval !== 0) return null;
    return elapsed / rule.interval + 1;
  }

  if (rule.freq !== "WEEKLY") return null;

  const startWeekday = new Date(startDayMs).getUTCDay();
  const targetWeekday = new Date(targetDayMs).getUTCDay();
  const days = rule.byDay.length > 0 ? rule.byDay : [startWeekday];
  if (!days.includes(targetWeekday)) return null;

  // Weeks are counted from the start's own week, so INTERVAL=2 means "every
  // other week counting from the first one" rather than from an epoch.
  const shift = (startWeekday + 6) % 7;
  const startWeek = Math.floor((startDayMs - shift * DAY_MS) / DAY_MS);
  const targetWeek = Math.floor(
    (targetDayMs - ((targetWeekday + 6) % 7) * DAY_MS) / DAY_MS,
  );
  const weeksApart = Math.round((targetWeek - startWeek) / 7);
  if (weeksApart < 0 || weeksApart % rule.interval !== 0) return null;

  const sorted = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const indexInWeek = sorted.indexOf(targetWeekday);
  const before = sorted.filter(
    (d) => ((d + 6) % 7) < ((startWeekday + 6) % 7),
  ).length;

  return (weeksApart / rule.interval) * sorted.length + indexInWeek + 1 - before;
}

/* -------------------------------------------------------------------------- */

interface RawEvent {
  uid: string;
  title: string;
  start: Stamp;
  durationMs: number;
  rule: Rule | null;
  exDates: Set<number>;
}

function collectEvents(lines: string[], zone: string): RawEvent[] {
  const events: RawEvent[] = [];
  let current: Partial<RawEvent> & { end?: Stamp } = {};
  let inside = false;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      inside = true;
      current = { exDates: new Set() };
      continue;
    }
    if (!inside) continue;

    if (line.startsWith("END:VEVENT")) {
      inside = false;
      const { uid, title, start, end, rule, exDates } = current;
      if (start && !start.allDay) {
        const durationMs =
          current.durationMs ??
          (end ? Math.max(60_000, end.ms - start.ms) : 3_600_000);
        events.push({
          uid: uid ?? `${start.ms}`,
          title: title || "Busy",
          start,
          durationMs,
          rule: rule ?? null,
          exDates: exDates ?? new Set(),
        });
      }
      if (events.length >= MAX_EVENTS) break;
      continue;
    }

    const prop = parseLine(line);
    if (!prop) continue;

    switch (prop.name) {
      case "UID":
        current.uid = prop.value.slice(0, 200);
        break;
      case "SUMMARY":
        current.title = unescapeText(prop.value).slice(0, 200);
        break;
      case "DTSTART":
        current.start = parseStamp(prop, zone) ?? undefined;
        break;
      case "DTEND":
        current.end = parseStamp(prop, zone) ?? undefined;
        break;
      case "DURATION": {
        const ms = parseDuration(prop.value);
        if (ms) current.durationMs = ms;
        break;
      }
      case "RRULE":
        current.rule = parseRule(prop.value);
        break;
      case "EXDATE":
        for (const one of prop.value.split(",")) {
          const stamp = parseStamp({ ...prop, value: one }, zone);
          if (stamp) {
            current.exDates?.add(utcMidnightOfLocalDay(stamp.ms, zone));
          }
        }
        break;
    }
  }

  return events;
}

/**
 * The events that occupy clock time on `day` (YYYY-MM-DD) as seen from `zone`.
 * Anything that ends before the day begins, starts after it ends, or has no
 * length inside it is left out.
 */
export function eventsOnDay(
  ics: string,
  day: string,
  zone: string,
): CalendarEvent[] {
  const [y, mo, d] = day.split("-").map(Number);
  if (!y || !mo || !d) return [];

  const dayStartMs = wallToUtc(y, mo, d, 0, 0, 0, zone);
  const dayEndMs = wallToUtc(y, mo, d + 1, 0, 0, 0, zone);
  const targetDayMs = Date.UTC(y, mo - 1, d);

  const out: CalendarEvent[] = [];

  for (const event of collectEvents(unfold(ics), zone)) {
    // A long event can start the day before and still occupy this morning, so
    // occurrences are looked for on this day and the one before it.
    const candidates: number[] = [];

    if (!event.rule) {
      candidates.push(event.start.ms);
    } else {
      const startDayMs = utcMidnightOfLocalDay(event.start.ms, zone);
      const startOfDayLocal = event.start.ms - startDayMs;

      for (const offset of [0, -1]) {
        const probe = targetDayMs + offset * DAY_MS;
        const ordinal = occurrenceOrdinal(event.rule, startDayMs, probe);
        if (ordinal === null) continue;
        if (event.rule.count !== null && ordinal > event.rule.count) continue;
        if (event.exDates.has(probe)) continue;

        const at = probe + startOfDayLocal;
        if (event.rule.untilMs !== null && at > event.rule.untilMs) continue;
        candidates.push(at);
      }
    }

    for (const startMs of candidates) {
      const endMs = startMs + event.durationMs;
      if (endMs <= dayStartMs || startMs >= dayEndMs) continue;

      const startMin = Math.max(
        0,
        Math.round((startMs - dayStartMs) / 60_000),
      );
      const endMin = Math.min(
        MINUTES_IN_DAY,
        Math.round((endMs - dayStartMs) / 60_000),
      );
      if (endMin <= startMin) continue;

      out.push({
        uid: `${event.uid}@${startMs}`,
        title: event.title,
        startMin,
        endMin,
      });
    }
  }

  return out.sort((a, b) => a.startMin - b.startMin);
}
