"use client";

import { motion } from "motion/react";
import type { PastSegment } from "@/lib/timeline/geometry";
import { formatClock } from "@/lib/time";
import { Icon } from "@/components/icons/Icon";
import { CLOCK_W, RAIL_W, RIBBON_SPRING } from "./motion";

/* Everything already over, in one row.

   Opening a planner at six in the evening should not mean scrolling past ten
   hours that already happened. The past stays one tap away — it just stops
   taking up the screen that the rest of the day needs. */

interface Props {
  segment: PastSegment;
  onExpand: () => void;
}

export function PastStrip({ segment, onExpand }: Props) {
  const { top, height, startMin, endMin, doneCount, missedCount } = segment;
  const total = segment.blocks.length;

  return (
    <motion.div
      layout
      className="absolute inset-x-0 z-10"
      style={{ top, height }}
      transition={RIBBON_SPRING}
    >
      <div
        className="absolute top-0 right-0 h-px"
        style={{ background: "var(--color-grid)", left: CLOCK_W }}
      />

      {/* The rail keeps running behind it: the day is continuous even where
          it is folded. */}
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{
          left: CLOCK_W + RAIL_W / 2,
          backgroundImage:
            "repeating-linear-gradient(to bottom, var(--color-rule) 0 2px, transparent 2px 6px)",
        }}
      />

      <button
        type="button"
        onClick={onExpand}
        className="group absolute inset-y-0 right-0 flex items-center gap-2.5 text-left"
        style={{ left: CLOCK_W + RAIL_W }}
      >
        <Icon
          name="chevron"
          size={13}
          className="shrink-0 rotate-90 text-faint transition-colors group-hover:text-accent"
        />
        <span className="text-fine text-faint transition-colors group-hover:text-ink">
          Earlier today
        </span>

        {total > 0 && (
          <span className="num flex items-center gap-2 text-micro text-faint">
            {doneCount > 0 && (
              <span className="text-done">{doneCount} done</span>
            )}
            {missedCount > 0 && (
              <span className="text-over">{missedCount} missed</span>
            )}
          </span>
        )}

        <span className="num ml-auto shrink-0 pr-1 text-micro text-faint opacity-60">
          {formatClock(startMin)}–{formatClock(endMin)}
        </span>
      </button>
    </motion.div>
  );
}
