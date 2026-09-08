"use client";

import { motion } from "motion/react";
import { formatClock, formatDuration } from "@/lib/time";
import { blockLook, lookColor } from "@/lib/blocks/look";
import { threadById, type Thread } from "@/lib/threads";
import type { PlacedBlock } from "@/lib/timeline/engine";

/* ==========================================================================
   The whole day, as one object.
   --------------------------------------------------------------------------
   Fourteen pixels tall and true to scale: every block sits at its real
   proportion of the waking day, so a glance answers the question a calendar
   never quite does — what shape is today? A dense morning and an empty
   afternoon are two different pictures here, and you see which one you have
   before reading a single word.

   Deliberately *linear* in time, unlike the ribbon below it. The ribbon
   compresses empty stretches so a day fits on a phone and stays readable;
   this cannot, because compressing it would destroy the only thing it has to
   say. The two are a pair: the bar is honest about proportion, the ribbon is
   honest about detail, and neither can be both.

   Tapping a band scrolls the ribbon to that block, which is what makes it an
   instrument rather than a decoration.
   ========================================================================== */

interface Props {
  placed: PlacedBlock[];
  threads: Thread[];
  dayStartMin: number;
  dayEndMin: number;
  nowMin: number;
  /** False on any day but today: there is no "now" on Thursday. */
  isToday: boolean;
  /** Minutes that are owed but have nowhere left to go. */
  overflowMin: number;
  /** Thinner, and without its clock ends — for the collapsed header. */
  compact?: boolean;
}

/** Bands thinner than this vanish; a fifteen-minute block must still show. */
const MIN_BAND_PCT = 1.2;

export function DayBar({
  placed,
  threads,
  dayStartMin,
  dayEndMin,
  nowMin,
  isToday,
  overflowMin,
  compact = false,
}: Props) {
  // The same widening the ribbon does: a block outside the planned day is
  // still part of the day, and a bar that cropped it would be lying.
  const from = Math.min(dayStartMin, ...placed.map((p) => p.startMin));
  const to = Math.max(dayEndMin, ...placed.map((p) => p.endMin));
  const span = Math.max(1, to - from);

  const pct = (min: number) => ((min - from) / span) * 100;
  const nowPct = Math.min(100, Math.max(0, pct(nowMin)));
  const showNow = isToday && nowMin >= from && nowMin <= to;

  return (
    <div className="select-none">
      <div
        className={`relative overflow-hidden rounded-edge bg-sunk ${
          compact ? "h-2" : "h-3.5"
        }`}
      >
        {/* Everything already gone, laid under the bands rather than over
            them: the past is context, not a curtain. */}
        {showNow && (
          <div
            className="absolute inset-y-0 left-0 bg-grid/70"
            style={{ width: `${nowPct}%` }}
          />
        )}

        {placed.map((p) => {
          const colour = lookColor(
            blockLook(p.block, threadById(threads, p.block.threadId)),
          );
          const left = pct(p.startMin);
          const width = Math.max(MIN_BAND_PCT, pct(p.endMin) - left);
          const done = p.block.status === "done";

          return (
            <button
              key={p.block.id}
              type="button"
              onClick={() => {
                document
                  .getElementById(`block-${p.block.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              aria-label={`${p.block.title} at ${formatClock(p.startMin)}`}
              title={`${p.block.title} · ${formatClock(p.startMin)}`}
              className="absolute inset-y-0"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: colour ?? "var(--color-rule)",
                // A finished block is history rather than a claim on the rest
                // of the day, so it steps back without disappearing.
                opacity: done ? 0.45 : p.block.external ? 0.5 : 1,
              }}
            />
          );
        })}

        {/* What will not fit, drawn at the end of the day where it would have
            to go if the day were longer. Hatched, because these are not
            minutes you have — they are minutes you are short.

            This is the whole of the capacity signal, and it belongs here: you
            could previously pour eighteen hours into a fourteen-hour day and
            find out only by scrolling to a tray at the very bottom. */}
        {overflowMin > 0 && (
          <div
            className="absolute inset-y-0 right-0"
            style={{
              width: `${Math.min(55, (overflowMin / span) * 100)}%`,
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--color-over) 0 2px, transparent 2px 5px)",
              boxShadow: "inset 0 0 0 1px var(--color-over)",
            }}
          />
        )}

        {/* Now. Drawn last so nothing can cover it, and in paper as well as
            accent so it reads against a band of any colour. */}
        {showNow && (
          <motion.div
            className="absolute inset-y-0 w-[3px]"
            initial={false}
            animate={{ left: `${nowPct}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 34 }}
            style={{
              background: "var(--color-accent)",
              boxShadow: "0 0 0 1px var(--color-paper)",
              marginLeft: -1.5,
            }}
          />
        )}
      </div>

      {!compact && (
      <div className="num mt-1.5 flex justify-between text-micro leading-none">
        <span className="text-faint">{formatClock(from)}</span>
        {overflowMin > 0 ? (
          <span className="text-over">
            {formatDuration(overflowMin)} past the end
          </span>
        ) : (
          <span className="text-faint">{formatClock(to)}</span>
        )}
      </div>
      )}
    </div>
  );
}
