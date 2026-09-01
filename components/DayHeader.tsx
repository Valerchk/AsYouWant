"use client";

import { AnimatePresence, motion } from "motion/react";
import { formatClock, formatDuration, daysBetween, weekdayOf } from "@/lib/time";
import { Icon } from "@/components/icons/Icon";
import { WeekStrip } from "@/components/WeekStrip";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Props {
  /** The day on screen, which is no longer always today. */
  date: string;
  today: string;
  nowMin: number;
  /** Blocks per day across the visible week, for the strip's marks. */
  counts: Map<string, number>;
  onPickDate: (day: string) => void;
  plannedMin: number;
  freeMin: number;
  blockCount: number;
  overflowCount: number;
  /** Things you mean to do today that take no place on the clock. */
  intentionCount: number;
  confirmed: boolean;
  onConfirm: () => void;
  /** Everything that is not the day itself, behind one button. */
  onOpenMenu: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Today", "Tomorrow", or a date that names itself. */
function titleFor(date: string, today: string): string {
  const delta = daysBetween(today, date);
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  const [, month, day] = date.split("-").map(Number);
  return `${WEEKDAYS[weekdayOf(date)]} ${day} ${MONTHS[month - 1]}`;
}

/** The full date, spelled out under the day's name. */
function longDate(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${WEEKDAYS[weekdayOf(date)]} ${day} ${MONTHS[month - 1]}`;
}

/** The separator between the day's numbers. */
function Dot() {
  return <span className="text-faint">·</span>;
}

export function DayHeader({
  date,
  today,
  nowMin,
  counts,
  onPickDate,
  plannedMin,
  freeMin,
  blockCount,
  overflowCount,
  intentionCount,
  confirmed,
  onConfirm,
  onOpenMenu,
}: Props) {
  const isToday = date === today;

  return (
    <header className="safe-top px-6 pt-4">
      <WeekStrip
        date={date}
        today={today}
        counts={counts}
        onPick={onPickDate}
      />

      <div className="mt-3 flex items-start gap-2.5">
        <div className="min-w-0">
          <h1 className="display text-title text-deep">
            {titleFor(date, today)}
          </h1>
          {/* The clock belongs to today alone. Printing the current time over
              Thursday's plan says something untrue about Thursday, so any
              other day gets its own date spelled out instead. */}
          {isToday ? (
            <Clock nowMin={nowMin} />
          ) : (
            // Only where the heading is a word. Three days out the heading is
            // already "Thu 4 Sep", and printing it again underneath is noise.
            Math.abs(daysBetween(today, date)) === 1 && (
              <div className="num mt-1 text-fine text-faint">
                {longDate(date)}
              </div>
            )
          )}
        </div>

        {/* Two controls, not four. Everything else — the evening review, day
            templates, settings — is named in words behind the second one.
            Four unlabelled glyphs in a row asked people to guess, and one of
            them was guessing wrong on purpose: settings wore the mark for how
            long a block is. */}
        <div className="-mr-2 ml-auto flex shrink-0 items-center">
          <ThemeToggle />
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="More"
            title="More"
            className="flex h-9 w-9 items-center justify-center rounded-edge text-faint transition-colors hover:bg-sunk hover:text-ink"
          >
            <Icon name="more" size={19} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-rule pt-2.5 text-micro">
        <span className="num text-ink">
          {blockCount} {blockCount === 1 ? "block" : "blocks"}
        </span>
        <Dot />
        <span className="num text-ink">{formatDuration(plannedMin)}</span>
        <Dot />
        <span className="num text-accent">{formatDuration(freeMin)} free</span>
        {intentionCount > 0 && (
          <>
            <Dot />
            <span className="num text-ink">{intentionCount} intentions</span>
          </>
        )}
        {overflowCount > 0 && (
          <>
            <Dot />
            <span className="num text-over">{overflowCount} won&rsquo;t fit</span>
          </>
        )}
      </div>

      {/* The morning ritual. Until the day is agreed to, the app stays quiet:
          no reminders are sent for a plan nobody signed off on. */}
      {!confirmed && isToday && (
        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 flex w-full items-center gap-3 rounded-plate bg-accent-soft px-4 py-3.5 text-left ring-1 ring-accent/25 transition-shadow hover:shadow-lift"
        >
          <Icon name="sunrise" size={17} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-fine text-deep">Confirm the day</span>
            <span className="block text-micro text-faint">
              Reminders start once you do
            </span>
          </span>
          <Icon name="chevron" size={14} className="shrink-0 text-accent" />
        </button>
      )}
    </header>
  );
}

/* --------------------------------------------------------------------------
   The clock.

   It was twelve pixels of monospace beside the heading, which is the size of
   a footnote — and it was fed by a timer that fired every thirty seconds
   without regard for where the minute boundary was, so it could sit a full
   half-minute behind the phone's own status bar. lib/useNow now sleeps to the
   boundary itself; this is the half of the fix you can see.

   The minutes roll rather than swap. A digit that simply changes is easy to
   miss on a screen you glance at, and the whole claim of this app is that it
   is keeping up with the actual day.
   -------------------------------------------------------------------------- */
function Clock({ nowMin }: { nowMin: number }) {
  const [hh, mm] = formatClock(nowMin).split(":");

  return (
    <div
      className="num mt-0.5 flex items-baseline text-title leading-none tracking-[-0.02em] text-deep"
      role="timer"
      aria-live="off"
      aria-label={`Now ${hh}:${mm}`}
    >
      <RollingPart value={hh} />
      {/* Breathing once every two seconds: enough to say the number is live,
          slow enough not to flicker in the corner of your eye all day. */}
      <span className="tick mx-[0.06em] text-accent">:</span>
      <RollingPart value={mm} />
    </div>
  );
}

function RollingPart({ value }: { value: string }) {
  return (
    <span className="relative inline-block overflow-hidden align-baseline">
      {/* Holds the box open at the right size while the two digits cross. */}
      <span className="invisible" aria-hidden>
        {value}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="absolute inset-0"
          initial={{ y: "-70%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "70%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 460, damping: 38 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
