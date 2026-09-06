"use client";

import { motion } from "motion/react";
import type { GapSegment } from "@/lib/timeline/geometry";
import { formatClock, formatDuration } from "@/lib/time";
import { Icon } from "@/components/icons/Icon";
import { CLOCK_W, RAIL_W, RIBBON_SPRING } from "./motion";

/* ==========================================================================
   Time nobody has claimed.
   --------------------------------------------------------------------------
   Planning is the whole job of this screen, so the parts of the day that are
   still free are the parts that matter most — and they used to be drawn as an
   apology: a hairline and four words of grey. An empty afternoon read as a
   defect rather than as the opportunity it is.

   Open time ahead of you is now a field you can put something in, the size of
   the hours it stands for, asking to be tapped. Time already gone is stated
   quietly and offers nothing, because there is nothing it could honestly
   offer.
   ========================================================================== */

interface Props {
  segment: GapSegment;
  nowMin: number;
  onFill: (startMin: number, minutes: number) => void;
}

export function GapStrip({ segment, nowMin, onFill }: Props) {
  const { startMin, endMin, top, height, collapsed } = segment;

  // Only the part still ahead counts as open. Measuring the whole span meant a
  // gap could advertise "14h open 08:00–22:00" at six in the evening, and
  // disagree with the "free" figure in the header, which has always counted
  // from now.
  const openFrom = Math.max(startMin, nowMin);
  const openMin = Math.max(0, endMin - openFrom);
  const spent = openMin === 0;

  // Short breathing room is drawn to scale and left alone — labelling every
  // ten-minute crack would turn the ribbon into a nag.
  if (!collapsed) {
    return (
      <motion.div
        layout
        className="absolute inset-x-0"
        style={{ top, height }}
        transition={RIBBON_SPRING}
      >
        <div
          className="absolute top-0 bottom-0 w-px"
          style={{ left: CLOCK_W + RAIL_W / 2, background: "var(--color-rule)" }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      className="absolute inset-x-0"
      style={{ top, height }}
      transition={RIBBON_SPRING}
    >
      {/* The rail keeps running through empty time — the day is continuous
          even where nothing is planned. Dashed, because this stretch of the
          ribbon is shorter than the time it stands for. */}
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{
          left: CLOCK_W + RAIL_W / 2,
          backgroundImage:
            "repeating-linear-gradient(to bottom, var(--color-rule) 0 3px, transparent 3px 7px)",
        }}
      />

      {spent ? (
        // Time that has already gone. Stated, not offered.
        <div
          className="absolute inset-y-0 flex items-center gap-2 text-micro text-faint opacity-60"
          style={{ left: CLOCK_W + RAIL_W }}
        >
          <span className="num">
            {formatClock(startMin)}–{formatClock(endMin)}
          </span>
          <span>unplanned</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onFill(openFrom, openMin)}
          className="group absolute inset-y-1 flex items-center justify-center gap-2 rounded-edge border border-dashed border-rule/70 text-faint transition-colors hover:border-accent/50 hover:bg-accent-soft/40 hover:text-accent"
          style={{ left: CLOCK_W + RAIL_W, right: 0 }}
        >
          <Icon
            name="plus"
            size={13}
            className="shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
          />
          <span className="num text-fine">{formatDuration(openMin)} open</span>
          <span className="num text-micro opacity-55">
            {formatClock(openFrom)}–{formatClock(endMin)}
          </span>
        </button>
      )}
    </motion.div>
  );
}
