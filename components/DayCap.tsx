"use client";

import { AnimatePresence, motion } from "motion/react";
import { DayBar } from "@/components/DayBar";
import { formatClock, formatDuration } from "@/lib/time";
import type { Thread } from "@/lib/threads";
import type { PlacedBlock } from "@/lib/timeline/engine";

/* ==========================================================================
   The header, once the header has gone.
   --------------------------------------------------------------------------
   Six stacked rows stand between you and the first block of the day: the week
   strip, the name of the day, the clock, the bar, the numbers, and — some
   mornings — the line asking you to confirm. Roughly two hundred pixels of
   chrome on a screen eight hundred tall.

   Every one of them earns its place at rest, when you have just opened the
   app and are deciding what the day is. None of them earns it while you are
   scrolling through the afternoon. So the tax is charged once: the moment the
   real header leaves the top of the screen this takes over, carrying only
   what stays useful — which day, what time, how much is left, and the shape
   of it all — in one line.
   ========================================================================== */

interface Props {
  show: boolean;
  title: string;
  nowMin: number;
  isToday: boolean;
  freeMin: number;
  placed: PlacedBlock[];
  threads: Thread[];
  dayStartMin: number;
  dayEndMin: number;
  overflowMin: number;
}

export function DayCap({
  show,
  title,
  nowMin,
  isToday,
  freeMin,
  placed,
  threads,
  dayStartMin,
  dayEndMin,
  overflowMin,
}: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          className="safe-top fixed inset-x-0 top-0 z-30 border-b border-rule bg-paper"
        >
          <button
            type="button"
            onClick={() =>
              window.scrollTo({ top: 0, behavior: "smooth" })
            }
            aria-label="Back to the top of the day"
            className="mx-auto block w-full max-w-2xl px-6 pt-2 pb-2.5 text-left"
          >
            <div className="flex items-baseline gap-2.5 text-micro">
              <span className="text-fine text-deep">{title}</span>
              {isToday && (
                <span className="num text-accent">{formatClock(nowMin)}</span>
              )}
              <span className="num ml-auto text-faint">
                {formatDuration(freeMin)} free
              </span>
            </div>
            <div className="mt-1.5">
              <DayBar
                placed={placed}
                threads={threads}
                dayStartMin={dayStartMin}
                dayEndMin={dayEndMin}
                nowMin={nowMin}
                isToday={isToday}
                overflowMin={overflowMin}
                compact
              />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
