"use client";

import { motion } from "motion/react";
import { yForMinute, type Geometry } from "@/lib/timeline/geometry";
import { formatClock } from "@/lib/time";
import { CLOCK_W, RAIL_W } from "./motion";

/* Where the block being dragged would land.

   Without it, dragging is a guess: the block follows your thumb but the
   ribbon says nothing about the time under it, and you only find out after
   letting go. */

export function DragGhost({
  geo,
  startMin,
  mode,
}: {
  geo: Geometry;
  startMin: number;
  /**
   * An anchor lands on a time, so the ghost names it. A flow block lands in a
   * queue, and the time it ends up with depends on everything above it — so
   * the ghost shows the place and says nothing about the clock rather than
   * naming a minute the block will not actually get.
   */
  mode: "time" | "insert";
}) {
  const y = yForMinute(geo, startMin);

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 z-20"
      style={{ top: y }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute h-[2px] rounded-plate"
        style={{ left: CLOCK_W, right: 0, background: "var(--color-accent)" }}
      />
      {mode === "time" ? (
        <div
          className="num absolute rounded-edge bg-accent px-1.5 py-0.5 text-micro leading-none text-paper"
          style={{ left: CLOCK_W + RAIL_W, top: -9 }}
        >
          {formatClock(startMin)}
        </div>
      ) : (
        <div
          className="absolute h-2 w-2 rounded-plate"
          style={{
            left: CLOCK_W + RAIL_W / 2 - 4,
            top: -3,
            background: "var(--color-accent)",
          }}
        />
      )}
    </motion.div>
  );
}
