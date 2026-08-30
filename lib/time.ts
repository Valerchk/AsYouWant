/* Every time in this app is an integer count of minutes from local midnight.
   Date objects are deliberately absent from the domain: a planner that mixes
   Date arithmetic with timezones is a planner that silently drifts an hour
   twice a year. Conversion to and from Date happens only at the edges. */

export const MINUTES_IN_DAY = 1440;

export function clampToDay(min: number): number {
  return Math.max(0, Math.min(MINUTES_IN_DAY, Math.round(min)));
}

/** 545 → "09:05". Always zero-padded so columns line up under tabular nums. */
export function formatClock(min: number): string {
  const m = clampToDay(min);
  const h = Math.floor(m / 60) % 24;
  const r = m % 60;
  return `${String(h).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** 90 → "1h 30", 45 → "45m", 120 → "2h". Compact enough for a block chip. */
export function formatDuration(min: number): string {
  const total = Math.max(0, Math.round(min));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}`;
}

/** Minutes from local midnight for a given instant, in the given IANA zone. */
export function minutesInZone(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** Calendar date (YYYY-MM-DD) for a given instant, in the given IANA zone. */
export function dateInZone(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
