"use client";

import { motion } from "motion/react";
import { formatClock } from "@/lib/time";
import { CLOCK_W, RAIL_W } from "./motion";

/* This minute, marked on the rail.

   The line used to run the full width and struck straight through whatever
   block title it crossed — legible neither as a line nor as a title. It now
   stops at the edge of the text column: the mark and the clock say where the
   moment is, and the running block itself (see BlockRow) says which block
   owns it. */

export function NowLine({ y, nowMin }: { y: number; nowMin: number }) {
  return (
    <motion.div
      // The scroll target when the app opens.
      id="now-anchor"
      layout
      className="pointer-events-none absolute inset-x-0 z-0"
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      style={{ top: y, height: 1 }}
    >
      {/* A short stub across the rail only — never into the titles. */}
      <div
        className="absolute h-px"
        style={{
          left: CLOCK_W,
          width: RAIL_W,
          background: "var(--color-accent)",
        }}
      />
      <div
        className="absolute rounded-plate"
        style={{
          left: CLOCK_W + RAIL_W / 2 - 4,
          top: -4,
          width: 8,
          height: 8,
          background: "var(--color-accent)",
        }}
      />
      <div
        className="num absolute text-micro leading-none font-medium text-accent"
        style={{ left: 0, top: -5, width: CLOCK_W - 10, textAlign: "right" }}
      >
        {formatClock(nowMin)}
      </div>
    </motion.div>
  );
}
