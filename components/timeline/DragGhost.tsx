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
}: {
  geo: Geometry;
  startMin: number;
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
      <div
        className="num absolute rounded-edge bg-accent px-1.5 py-0.5 text-micro leading-none text-paper"
        style={{ left: CLOCK_W + RAIL_W, top: -9 }}
      >
        {formatClock(startMin)}
      </div>
    </motion.div>
  );
}
