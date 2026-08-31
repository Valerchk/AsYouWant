import { weekdayOf } from "@/lib/time";

/* ==========================================================================
   A block that comes back.
   --------------------------------------------------------------------------
   The single most common reason people abandon a planner is retyping the same
   week every week. A routine is the smallest thing that fixes it: a block's
   shape plus the weekdays it belongs to.

   Deliberately not a recurrence rule engine. No "every third Tuesday", no end
   dates, no exceptions — a weekday mask covers what people actually schedule,
   and the ones it does not cover are better typed than configured.
   ========================================================================== */

export interface Routine {
  id: string;
  title: string;
  kind: "anchor" | "flow";
  startMin: number | null;
  plannedMin: number;
  threadId: string | null;
  /** Bit per weekday, Sunday = bit 0. Never 0 — that is a deletion. */
  repeatMask: number;
}

export type RoutineInput = Omit<Routine, "id">;

/** Monday first, because that is how a week is planned. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVERY_DAY = 0b1111111;
const WEEKDAYS = 0b0111110; // Mon–Fri
const WEEKEND = 0b1000001; // Sat + Sun

export function maskFor(weekday: number): number {
  return 1 << weekday;
}

export function repeatsOn(mask: number, weekday: number): boolean {
  return (mask & maskFor(weekday)) !== 0;
}

export function repeatsOnDay(mask: number, day: string): boolean {
  return repeatsOn(mask, weekdayOf(day));
}

export function toggleWeekday(mask: number, weekday: number): number {
  return mask ^ maskFor(weekday);
}

/** "Every day", "Weekdays", "Mon, Wed, Fri" — for a chip, not a sentence. */
export function describeRepeat(mask: number): string {
  if (mask === 0) return "Never";
  if (mask === EVERY_DAY) return "Every day";
  if (mask === WEEKDAYS) return "Weekdays";
  if (mask === WEEKEND) return "Weekends";
  return WEEKDAY_ORDER.filter((d) => repeatsOn(mask, d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(", ");
}

export const REPEAT_PRESETS: { label: string; mask: number }[] = [
  { label: "Every day", mask: EVERY_DAY },
  { label: "Weekdays", mask: WEEKDAYS },
  { label: "Weekends", mask: WEEKEND },
];
