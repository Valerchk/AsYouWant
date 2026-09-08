"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "@/components/icons/Icon";
import { formatDuration } from "@/lib/time";

/* ==========================================================================
   The turn towards tomorrow.
   --------------------------------------------------------------------------
   The hole this fills is the largest one the app had, and it was invisible
   because it was an absence: everything here was about today, and by the time
   anyone opens a planner in the evening today is already spent. A planner
   earns its keep the night before. This one had no surface for that at all —
   tomorrow was reachable through the week strip, and nothing ever suggested
   going there.

   It appears only after the evening hour, and it lands in the empty stretch
   below a finished day, which is space the screen was wasting anyway. The
   rest of the day it does not exist.

   Two doors, and the order is the argument: plan tomorrow first, look back
   second. A review that leads nowhere is a diary.
   ========================================================================== */

interface Props {
  /** Blocks still owed today. */
  openCount: number;
  /** Minutes those blocks were going to take. */
  openMin: number;
  onPlanTomorrow: () => void;
}

export function EveningTurn({ openCount, openMin, onPlanTomorrow }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className="mt-10 border-t border-rule pt-6"
    >
      <div className="flex items-start gap-3">
        <Icon name="moon" size={18} className="mt-0.5 shrink-0 text-faint" />
        <div className="min-w-0">
          <h2 className="text-lede text-deep">The day is closing</h2>
          <p className="mt-1 text-fine leading-6 text-faint">
            {openCount === 0
              ? "Nothing left owed today. Tomorrow is still blank — two minutes now buys the whole morning."
              : `${openCount} ${openCount === 1 ? "block" : "blocks"} still open, ${formatDuration(openMin)} of them. Carry what matters over and let the rest go.`}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          type="button"
          onClick={onPlanTomorrow}
          className="flex items-center gap-2 rounded-edge bg-accent px-4 py-2.5 text-fine text-paper transition-shadow hover:shadow-lift"
        >
          Plan tomorrow
          <Icon name="chevron" size={13} />
        </button>
        <Link
          href="/review"
          className="flex items-center gap-1.5 text-fine text-faint transition-colors hover:text-ink"
        >
          See the cut of today
          <Icon name="chevron" size={12} />
        </Link>
      </div>
    </motion.section>
  );
}
