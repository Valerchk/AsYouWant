"use client";

import { motion } from "motion/react";
import { CLOCK_W, RAIL_W } from "./motion";

/* This minute, laid across the day.

   It renders *beneath* the blocks (z-0 against their z-10) so it passes
   behind their text instead of striking through it — the earlier version sat
   on top and cut straight across whatever title it crossed. The solid part is
   the marker on the rail, where nothing competes with it. */

export function NowLine({ y }: { y: number }) {
  return (
    <motion.div
      // The scroll target when the app opens: you land on the moment you are
      // standing in, not at the top of the morning.
      id="now-anchor"
      layout
      className="pointer-events-none absolute inset-x-0 z-0"
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      style={{ top: y, height: 1 }}
    >
      <div
        className="absolute h-px"
        style={{
          left: CLOCK_W,
          right: 0,
          background: "var(--color-accent)",
          opacity: 0.4,
        }}
      />
      {/* The marker itself, on the rail where there is no text to obscure. */}
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
      {/* No clock label here. It shared the gutter with the blocks' own start
          times and collided with whichever one it drifted past; the current
          time lives in the header instead, where nothing moves under it. */}
    </motion.div>
  );
}
