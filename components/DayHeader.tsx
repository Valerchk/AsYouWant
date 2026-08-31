"use client";

import Link from "next/link";
import { formatClock, formatDuration, daysBetween, weekdayOf } from "@/lib/time";
import { Icon } from "@/components/icons/Icon";
import { WeekStrip } from "@/components/WeekStrip";
import { threadColor, type Thread } from "@/lib/threads";
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
  onOpenTemplates: () => void;
  /** Goals share the numbers line; tapping them opens the list. */
  threads: Thread[];
  onOpenGoals: () => void;
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
  onOpenTemplates,
  threads,
  onOpenGoals,
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

      {/* The clock beside the day's name rather than beneath it, and the
          day's numbers as one sentence rather than a rank of stacked pairs.
          The header used to run to roughly 250px before a single block of the
          day appeared; on a phone that is a third of the screen spent on
          chrome. */}
      <div className="mt-3 flex items-baseline gap-2.5">
        <h1 className="display text-title text-deep">
          {titleFor(date, today)}
        </h1>
        {/* The clock belongs to today alone. Printing the current time over
            Thursday's plan says something untrue about Thursday. */}
        {isToday && (
          <span className="num text-micro tracking-[0.14em] text-accent">
            {formatClock(nowMin)}
          </span>
        )}
        <div className="-mr-2 ml-auto flex shrink-0 items-center">
          <Link
            href="/review"
            aria-label="Evening review"
            title="Evening review"
            className="flex h-9 w-9 items-center justify-center rounded-edge text-faint transition-colors hover:bg-sunk hover:text-ink"
          >
            <Icon name="crossSection" size={17} />
          </Link>
          <button
            type="button"
            onClick={onOpenTemplates}
            aria-label="Day templates"
            title="Day templates"
            className="flex h-9 w-9 items-center justify-center rounded-edge text-faint transition-colors hover:bg-sunk hover:text-ink"
          >
            <Icon name="template" size={17} />
          </button>
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-edge text-faint transition-colors hover:bg-sunk hover:text-ink"
          >
            <Icon name="duration" size={17} />
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-rule pt-2.5 text-micro">
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

        {/* Goals ride the same line rather than claiming one of their own. */}
        {threads.length > 0 && (
          <button
            type="button"
            onClick={onOpenGoals}
            className="ml-auto flex shrink-0 items-center gap-1.5 text-faint transition-colors hover:text-ink"
          >
            <span className="flex -space-x-1">
              {threads.slice(0, 6).map((t) => (
                <span
                  key={t.id}
                  className="h-2.5 w-2.5 rounded-plate ring-1 ring-paper"
                  style={{ background: threadColor(t.colorIndex) }}
                />
              ))}
            </span>
            <Icon name="chevron" size={11} />
          </button>
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
