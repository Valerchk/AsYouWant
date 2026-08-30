"use client";

import { motion } from "motion/react";
import type { GapSegment } from "@/lib/timeline/geometry";
import { formatClock, formatDuration } from "@/lib/time";
import { Icon } from "@/components/icons/Icon";
import { CLOCK_W, RAIL_W, RIBBON_SPRING } from "./motion";

interface Props {
  segment: GapSegment;
  onFill: (startMin: number, endMin: number) => void;
}

export function GapStrip({ segment, onFill }: Props) {
  const { startMin, endMin, top, height, collapsed } = segment;
  const minutes = endMin - startMin;

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

      <button
        type="button"
        onClick={() => onFill(startMin, endMin)}
        className="group absolute inset-y-0 flex items-center gap-2 text-fine text-faint transition-colors hover:text-accent"
        style={{ left: CLOCK_W + RAIL_W }}
      >
        <Icon
          name="plus"
          size={13}
          className="opacity-0 transition-opacity group-hover:opacity-100"
        />
        <span className="num">{formatDuration(minutes)} open</span>
        <span className="num text-micro opacity-60">
          {formatClock(startMin)}–{formatClock(endMin)}
        </span>
      </button>
    </motion.div>
  );
}
