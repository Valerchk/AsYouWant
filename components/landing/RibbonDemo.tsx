"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { formatClock, formatDuration } from "@/lib/time";

/* The pitch, performed rather than described.

   A short loop: a block is running, it closes early, and the rest of the day
   springs upward into the minutes it gave back. That compression is the whole
   product, and no screenshot can show it.

   Deliberately self-contained — no engine, no store. A landing page that can
   break because a data layer changed is a landing page that will. */

interface Row {
  id: string;
  title: string;
  thread: string;
  colour: string;
  min: number;
}

const ROWS: Row[] = [
  { id: "a", title: "Deep work", thread: "Thesis", colour: "var(--color-thread-1)", min: 90 },
  { id: "b", title: "Standup", thread: "Work", colour: "var(--color-thread-4)", min: 30 },
  { id: "c", title: "Review", thread: "Work", colour: "var(--color-thread-4)", min: 45 },
  { id: "d", title: "Gym", thread: "Health", colour: "var(--color-thread-3)", min: 60 },
];

const START = 9 * 60;
const SAVED = 18;

/** Row heights, in the same spirit as the real ribbon: longer blocks are taller. */
const height = (min: number) => Math.max(56, Math.round(min * 0.62));

export function RibbonDemo() {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    // Run the loop, then hold each state long enough to read it.
    const t = setInterval(() => setClosed((c) => !c), 3200);
    return () => clearInterval(t);
  }, []);

  // Everything after the first block starts earlier once it closes early.
  // Written as a prefix sum rather than a running cursor: mutating a variable
  // across a map is exactly what the compiler rules forbid, and with four rows
  // the recomputation costs nothing.
  const laid = ROWS.map((row, i) => {
    const before = ROWS.slice(0, i).reduce(
      (sum, r, j) => sum + (j === 0 && closed ? r.min - SAVED : r.min),
      0,
    );
    return { row, at: START + before, height: height(row.min) };
  });

  return (
    <div className="relative select-none" aria-hidden>
      <div className="flex flex-col">
        {laid.map(({ row, at, height: h }, i) => {
          const isFirst = i === 0;
          const done = isFirst && closed;

          return (
            <motion.div
              key={row.id}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="relative grid"
              style={{
                height: done ? h - SAVED * 0.62 : h,
                gridTemplateColumns: "48px 22px minmax(0,1fr) auto",
              }}
            >
              <div className="absolute top-0 right-0 left-[48px] h-px bg-grid" />

              <div className="num pt-2.5 pr-2 text-right text-micro leading-5 text-faint">
                {formatClock(at)}
              </div>

              <div className="relative">
                <div
                  className="absolute top-0 bottom-0 left-1/2 w-[3px] -translate-x-1/2"
                  style={{ background: row.colour, opacity: done ? 0.3 : 0.9 }}
                />
                <motion.div
                  className="absolute top-[3px] left-1/2 flex h-[17px] w-[17px] -translate-x-1/2 items-center justify-center rounded-plate"
                  animate={{ scale: done ? 1 : 0.92 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24 }}
                  style={{
                    background: done ? row.colour : "var(--color-paper)",
                    boxShadow: `inset 0 0 0 1.5px ${row.colour}`,
                  }}
                >
                  {done && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 12l5 5 11-11"
                        stroke="var(--color-paper)"
                        strokeWidth="3"
                      />
                    </svg>
                  )}
                </motion.div>
              </div>

              <div className="min-w-0 pt-2.5 pr-2">
                <div
                  className={`truncate text-base leading-5 ${
                    done ? "text-faint" : "text-ink"
                  }`}
                >
                  {row.title}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-micro leading-none text-faint">
                  <span
                    className="inline-block h-[2px] w-3"
                    style={{ background: row.colour }}
                  />
                  {row.thread}
                </div>
              </div>

              <div className="flex flex-col items-end pt-2.5">
                <span className="num text-micro leading-5 text-faint">
                  {formatDuration(row.min)}
                </span>
                {done && (
                  <motion.span
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="num mt-1 flex items-center gap-1 text-micro text-accent"
                  >
                    <svg width="8" height="9" viewBox="0 0 9 10" fill="none">
                      <path
                        d="M4.5 9.5V1M1 4.5 4.5 1 8 4.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    {SAVED}m
                  </motion.span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-2 text-micro text-faint">
        <span
          className={`h-1.5 w-1.5 rounded-plate transition-colors ${
            closed ? "bg-accent" : "bg-rule"
          }`}
        />
        {closed
          ? "Finished early — the rest of the day moved up."
          : "One block running. The plan still holds."}
      </div>
    </div>
  );
}
