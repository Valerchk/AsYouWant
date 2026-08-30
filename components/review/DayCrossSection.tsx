"use client";

import { motion } from "motion/react";
import { threadColor } from "@/lib/threads";

/* The day, cut through and looked at end-on.

   Each ring is a goal; its thickness is the time that goal actually got. Not
   a pie chart: a pie divides one fixed circle, so a thin day and a full day
   look identical. Rings grow outward, so the whole figure is bigger on a day
   where more happened — which is the honest reading. */

export interface Strand {
  threadId: string | null;
  name: string;
  colorIndex: number;
  minutes: number;
}

const SIZE = 260;
const CENTRE = SIZE / 2;
const CORE = 16;
const MAX_R = CENTRE - 12;

export function DayCrossSection({ strands }: { strands: Strand[] }) {
  const total = strands.reduce((sum, s) => sum + s.minutes, 0);
  if (total === 0) return null;

  // Rings stack outward from the core, each as thick as its share of the day.
  // Written as a prefix sum rather than a running radius: reassigning across a
  // map is what the compiler rules forbid, and these lists are a handful long.
  const available = MAX_R - CORE;
  const rings = strands.map((strand, i) => {
    const inner =
      CORE +
      strands
        .slice(0, i)
        .reduce((sum, s) => sum + (s.minutes / total) * available, 0);
    return { strand, inner, width: (strand.minutes / total) * available };
  });

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto block h-auto w-full max-w-[260px]"
      role="img"
      aria-label="The day, by goal"
    >
      {/* the core: the day itself, before any goal claims it */}
      <circle cx={CENTRE} cy={CENTRE} r={CORE} fill="var(--color-sunk)" />

      {rings.map(({ strand, inner, width }, i) => {
        // Stroke sits on the centre line of the band, so the radius is the
        // middle of the ring rather than its inner edge.
        const r = inner + width / 2;
        const circumference = 2 * Math.PI * r;
        return (
          <motion.circle
            key={strand.threadId ?? `none-${i}`}
            cx={CENTRE}
            cy={CENTRE}
            r={r}
            fill="none"
            stroke={
              strand.threadId
                ? threadColor(strand.colorIndex)
                : "var(--color-rule)"
            }
            strokeWidth={Math.max(1.5, width - 1.5)}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference, opacity: 0 }}
            animate={{ strokeDashoffset: 0, opacity: 1 }}
            transition={{
              duration: 0.9,
              delay: i * 0.12,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            // Draw from the top, the way a clock starts.
            transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
          />
        );
      })}
    </svg>
  );
}
