"use client";

import Link from "next/link";
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
  onOpenTemplates: () => void;
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

function Metric({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "accent" | "over";
}) {
  const colour =
    tone === "accent" ? "text-accent" : tone === "over" ? "text-over" : "text-ink";
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`num text-fine leading-none ${colour}`}>{value}</span>
      <span className="text-micro leading-none text-faint">{label}</span>
    </div>
  );
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
}: Props) {
  const isToday = date === today;

  return (
    <header className="safe-top px-6 pt-5">
      <WeekStrip
        date={date}
        today={today}
        counts={counts}
        onPick={onPickDate}
      />

      <div className="mt-4 flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="display text-title text-deep">
            {titleFor(date, today)}
          </h1>
          {/* The clock belongs to today alone. Printing the current time over
              Thursday's plan says something untrue about Thursday. */}
          {isToday && (
            <div className="num mt-1 text-micro tracking-[0.18em] text-accent">
              {formatClock(nowMin)}
            </div>
          )}
        </div>
        <div className="-mr-2 flex items-center">
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

      <div className="mt-5 flex items-end gap-7 border-t border-rule pt-4">
        <Metric label="blocks" value={String(blockCount)} />
        <Metric label="planned" value={formatDuration(plannedMin)} />
        <Metric label="free" value={formatDuration(freeMin)} tone="accent" />
        {intentionCount > 0 && (
          <Metric label="intentions" value={String(intentionCount)} />
        )}
        {overflowCount > 0 && (
          <Metric label="won't fit" value={String(overflowCount)} tone="over" />
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
