"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { formatClock, formatDuration } from "@/lib/time";

/* ==========================================================================
   The pitch, performed rather than described.
   --------------------------------------------------------------------------
   A short loop: a block is running, it closes fifteen minutes early, and the
   rest of the day springs upward into the minutes it handed back. That
   compression is the whole product, and no screenshot can show it.

   Deliberately self-contained — no engine, no store. A landing page that can
   break because a data layer changed is a landing page that will.

   Two things were wrong with the first version of this and both were visible.
   Every row was a flex child carrying motion's `layout` while its height was
   also being animated through an inline style, so the two systems fought for
   the same pixels and the whole column shivered on every transition. And the
   times were derived by adding raw durations to 09:00, which produced 10:12,
   10:42, 11:27 — a schedule nobody would ever write, sitting on the page as
   the first thing a visitor reads.

   Now: one absolutely positioned stage of a fixed height, tops and heights
   both driven by a single spring, and a day made of round hours.
   ========================================================================== */

interface Row {
  id: string;
  title: string;
  thread: string;
  colour: string;
  min: number;
}

const ROWS: Row[] = [
  { id: "a", title: "Deep work", thread: "Thesis", colour: "var(--thread-1)", min: 90 },
  { id: "b", title: "Standup", thread: "Work", colour: "var(--thread-4)", min: 30 },
  { id: "c", title: "Review", thread: "Work", colour: "var(--thread-4)", min: 45 },
  { id: "d", title: "Gym", thread: "Health", colour: "var(--thread-3)", min: 60 },
];

const START = 9 * 60;
const SAVED = 15;

/* Same geometry as the real ribbon: longer blocks are taller, but a short one
   still gets enough room for its own title. Positions are prefix sums of
   these, never of the raw minutes, so nothing can land half a line off. */
const PX_PER_MIN = 1.25;
/* Exactly the room a title and its goal need, and no more, so that thirty
   minutes and forty-five are visibly different lengths. At the old floor both
   came out the same height, which quietly contradicted the numbers printed
   beside them. */
const MIN_H = 46;
const height = (min: number) => Math.max(MIN_H, Math.round(min * PX_PER_MIN));

const CLOCK_W = 46;
const RAIL_W = 22;

/** Tall enough for the fuller of the two states, so the card never resizes. */
const STAGE_H = ROWS.reduce((sum, r) => sum + height(r.min), 0);

/** Pixels everything below the first block travels when it finishes early. */
const PULL_UP = height(ROWS[0].min - SAVED) - height(ROWS[0].min);

/* Where "now" is. It climbs through the first block while that block runs,
   and then simply stops — and the day rises to meet it. That is the argument
   the page is making, stated as one moving line rather than as a sentence:
   the plan comes to where you actually are, not the other way round. */
const NOW_FROM = Math.round(height(ROWS[0].min) * 0.34);
const NOW_TO = height(ROWS[0].min - SAVED);

const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

export function RibbonDemo() {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    // Run the loop, then hold each state long enough to read it.
    const t = setInterval(() => setClosed((c) => !c), 3400);
    return () => clearInterval(t);
  }, []);

  /* Each row's resting place is a prefix sum of the full-length heights, and
     it is written into `style` so the server renders the day already laid
     out. What the loop changes is a transform on top of that — a translation
     for the rows below, a height for the one that finished — because a
     transform is composited and a `top` is not. */
  const laid = ROWS.map((row, i) => {
    const done = i === 0 && closed;
    const base = ROWS.slice(0, i).reduce((sum, r) => sum + height(r.min), 0);
    const minsBefore = ROWS.slice(0, i).reduce((sum, r) => sum + r.min, 0);
    return {
      row,
      done,
      base,
      h: height(done ? row.min - SAVED : row.min),
      shift: closed && i > 0 ? PULL_UP : 0,
      at: START + minsBefore - (closed && i > 0 ? SAVED : 0),
    };
  });

  return (
    <div className="select-none" aria-hidden>
      <div className="relative" style={{ height: STAGE_H }}>
        {/* The rail's ground line, behind everything. */}
        <div
          className="absolute top-0 bottom-0 w-px bg-grid"
          style={{ left: CLOCK_W + RAIL_W / 2 }}
        />

        {laid.map(({ row, done, base, h, shift, at }, i) => {
          const running = i === 0 && !closed;

          return (
            <motion.div
              key={row.id}
              className="absolute inset-x-0"
              // Height in `style` as well, so the server renders each block at
              // its real size; motion takes the property over once it mounts.
              style={{ top: base, height: height(row.min) }}
              initial={false}
              animate={{ y: shift, height: h }}
              // Staggered by a frame and a half each. The day does not jump to
              // its new shape in one cut — the block lets go, the next takes
              // up the slack, and the one after that follows. Reading it as a
              // chain rather than a jump is the whole difference between an
              // animation and a transition.
              transition={{ ...SPRING, delay: closed ? i * 0.045 : 0 }}
            >
              {/* The block, filled with its own colour — the same mix the app
                  uses, so the page shows what you actually get. */}
              <div
                className="absolute rounded-edge"
                style={{
                  left: CLOCK_W + RAIL_W,
                  right: 0,
                  top: 1,
                  bottom: 1,
                  background: `color-mix(in oklab, ${row.colour} ${
                    done ? 10 : running ? 30 : 20
                  }%, var(--color-paper))`,
                }}
              />

              {/* `relative`, and it is load-bearing. The fill above is
                  absolutely positioned, and CSS paints positioned elements
                  over in-flow ones inside the same stacking context — so a
                  static grid here put every title, goal and duration
                  underneath the colour, and the demo rendered as four blank
                  slabs. The real ribbon escapes this by accident: its title
                  carries `relative` for other reasons. */}
              <div
                className="relative grid h-full"
                style={{
                  gridTemplateColumns: `${CLOCK_W}px ${RAIL_W}px minmax(0,1fr) auto`,
                }}
              >
                <div className="num pt-3 pr-2 text-right text-micro leading-5 text-faint">
                  {/* Crossfaded rather than swapped: the number changing is
                      the point being made, so it should be seen changing. */}
                  <motion.span
                    key={at}
                    className="inline-block"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                  >
                    {formatClock(at)}
                  </motion.span>
                </div>

                <div className="relative">
                  <div
                    className="absolute top-0 bottom-0 left-1/2 w-[3px] -translate-x-1/2"
                    style={{
                      background: running ? "var(--color-accent)" : row.colour,
                      opacity: done ? 0.3 : 0.9,
                    }}
                  />
                  <motion.div
                    className="absolute top-[3px] left-1/2 flex h-[18px] w-[18px] -translate-x-1/2 items-center justify-center rounded-plate"
                    animate={{ scale: done ? 1 : 0.92 }}
                    transition={{ type: "spring", stiffness: 500, damping: 24 }}
                    style={{
                      background: done ? row.colour : "var(--color-paper)",
                      boxShadow: `inset 0 0 0 1.5px ${
                        running ? "var(--color-accent)" : row.colour
                      }`,
                    }}
                  >
                    {done && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 12l5 5 11-11"
                          stroke="var(--color-paper)"
                          strokeWidth="3"
                        />
                      </svg>
                    )}
                  </motion.div>
                </div>

                <div className="min-w-0 pt-3 pr-2">
                  <div
                    className={`truncate text-lede leading-5 ${
                      done ? "text-faint" : "text-ink"
                    }`}
                  >
                    {row.title}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-micro leading-none text-faint">
                    <span
                      className="inline-block h-[2px] w-3"
                      style={{ background: row.colour }}
                    />
                    {row.thread}
                  </div>
                </div>

                <div className="flex flex-col items-end pt-3">
                  <span className="num text-micro leading-5 text-faint">
                    {formatDuration(done ? row.min - SAVED : row.min)}
                  </span>
                  {done && (
                    <motion.span
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="num mt-1.5 flex items-center gap-1 text-micro text-accent"
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
              </div>
            </motion.div>
          );
        })}

        {/* Now. Rendered last so it rides over the blocks, and keyed on the
            beat so the climb restarts each cycle: running, it travels; closed,
            it holds while the day springs up underneath it. */}
        <motion.div
          key={closed ? "now-held" : "now-running"}
          className="pointer-events-none absolute right-0 z-20 flex items-center"
          // Travels on a transform, not on `top`: this is the one thing on the
          // page that moves for three seconds straight, and a layout property
          // would have it recomputing the card on every frame of that.
          style={{ top: NOW_FROM, left: CLOCK_W + RAIL_W / 2, marginTop: -3 }}
          initial={{ y: closed ? NOW_TO - NOW_FROM : 0 }}
          animate={{ y: NOW_TO - NOW_FROM }}
          transition={
            closed ? { duration: 0 } : { duration: 3.2, ease: "linear" }
          }
        >
          <span className="h-1.5 w-1.5 shrink-0 -translate-x-1/2 rounded-plate bg-accent" />
          <span className="h-px flex-1 bg-accent/45" />
        </motion.div>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-grid pt-4 text-micro text-faint">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-plate transition-colors ${
            closed ? "bg-accent" : "bg-rule"
          }`}
        />
        {/* Crossfaded in place rather than swapped: the line is part of the
            loop, and a caption that blinks undoes the calm of everything
            above it. A fixed height keeps the card from breathing. */}
        <span className="relative block h-4 flex-1">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={closed ? "closed" : "running"}
              className="absolute inset-0 leading-4"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {closed
                ? "Finished early — the rest of the day moved up."
                : "One block running. The plan still holds."}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
}
