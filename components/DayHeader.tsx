"use client";

import { formatClock, formatDuration } from "@/lib/time";
import { Icon } from "@/components/icons/Icon";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

interface Props {
  nowMin: number;
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

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

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
  nowMin,
  plannedMin,
  freeMin,
  blockCount,
  overflowCount,
  intentionCount,
  confirmed,
  onConfirm,
  onOpenTemplates,
}: Props) {
  const now = new Date();
  const stamp = `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  return (
    <header className="safe-top px-6 pt-7">
      <div className="flex items-start justify-between">
        <div>
          <div className="num flex items-baseline gap-2.5 text-micro tracking-[0.18em] text-faint">
            {stamp}
            {/* The current time lives here rather than on the ribbon, where its
                label kept colliding with the blocks' own start times. */}
            <span className="tracking-normal text-accent">
              {formatClock(nowMin)}
            </span>
          </div>
          <h1 className="display mt-1.5 text-title text-deep">Today</h1>
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

      <div className="mt-6 flex items-end gap-7 border-t border-rule pt-4">
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
      {!confirmed && (
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
