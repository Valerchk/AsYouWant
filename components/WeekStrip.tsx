"use client";

import { motion } from "motion/react";
import { Icon } from "@/components/icons/Icon";
import { addDays, weekOf } from "@/lib/time";

/* The week the day sits in.

   It replaces the date stamp rather than sitting above it, so the app gained
   six more days without gaining a row. The dot under a date means that day
   holds something — without it, moving between days is tapping in the dark to
   find out where the work is. */

const INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

export function WeekStrip({
  date,
  today,
  counts,
  onPick,
}: {
  date: string;
  today: string;
  /** Blocks per day, for the days this strip can see. */
  counts: Map<string, number>;
  onPick: (day: string) => void;
}) {
  const week = weekOf(date);

  return (
    <div className="flex items-center gap-1">
      <Arrow
        label="Previous week"
        onClick={() => onPick(addDays(date, -7))}
        back
      />

      <div className="flex flex-1 justify-between">
        {week.map((day, i) => {
          const selected = day === date;
          const isToday = day === today;
          const has = (counts.get(day) ?? 0) > 0;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onPick(day)}
              aria-current={selected ? "date" : undefined}
              aria-label={day}
              className="relative flex h-11 w-9 flex-col items-center justify-center gap-0.5"
            >
              {selected && (
                <motion.span
                  layoutId="week-selected"
                  className="absolute inset-x-0 inset-y-0 rounded-edge bg-sunk ring-1 ring-rule"
                  transition={{ type: "spring", stiffness: 460, damping: 36 }}
                />
              )}
              <span
                className={`relative text-micro leading-none ${
                  isToday ? "text-accent" : "text-faint"
                }`}
              >
                {INITIALS[i]}
              </span>
              <span
                className={`num relative text-fine leading-none ${
                  selected ? "text-deep" : isToday ? "text-accent" : "text-ink"
                }`}
              >
                {Number(day.slice(8))}
              </span>
              <span
                className="relative h-1 w-1 rounded-plate"
                style={{
                  background: has ? "var(--color-accent)" : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>

      <Arrow label="Next week" onClick={() => onPick(addDays(date, 7))} />
    </div>
  );
}

function Arrow({
  label,
  onClick,
  back = false,
}: {
  label: string;
  onClick: () => void;
  back?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-6 shrink-0 items-center justify-center text-faint transition-colors hover:text-ink"
    >
      <Icon name="chevron" size={14} className={back ? "rotate-180" : ""} />
    </button>
  );
}
