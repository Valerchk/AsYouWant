"use client";

import { motion } from "motion/react";
import type { BlockSegment } from "@/lib/timeline/geometry";
import { formatClock, formatDuration } from "@/lib/time";
import { threadColor, type Thread } from "@/lib/threads";
import { Icon } from "@/components/icons/Icon";
import { CLOCK_W, RAIL_W, RIBBON_SPRING } from "./motion";

interface Props {
  segment: BlockSegment;
  thread: Thread | null;
  /** Minutes this block handed back by finishing early. */
  slackMin: number;
  onToggleDone: (blockId: string) => void;
  onOpen: (blockId: string) => void;
}

export function BlockRow({
  segment,
  thread,
  slackMin,
  onToggleDone,
  onOpen,
}: Props) {
  const { placed, top, height } = segment;
  const { block, isRunning, isMissed, overrunMin } = placed;
  const done = block.status === "done";

  const colour = thread ? threadColor(thread.colorIndex) : "var(--color-rule)";
  const accent = isRunning
    ? overrunMin > 0
      ? "var(--color-over)"
      : "var(--color-accent)"
    : colour;

  return (
    <motion.div
      // `top` is real CSS, not an animated transform. Carrying the position
      // only in `animate={{ y }}` meant any frame where the animation had not
      // run stacked every segment at one point, and the overlapping hit areas
      // swallowed taps. Layout must never depend on animation.
      layout
      className="absolute inset-x-0 z-10"
      style={{ top, height }}
      transition={RIBBON_SPRING}
    >
      {/* A hairline above every block. On paper, blocks with no separation
          read as one undifferentiated column. */}
      <div
        className="absolute top-0 right-0 h-px"
        style={{ background: "var(--color-grid)", left: CLOCK_W }}
      />

      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: `${CLOCK_W}px ${RAIL_W}px minmax(0,1fr) auto`,
        }}
      >
        {/* clock — right-aligned so colons line up down the whole day */}
        <div className="num pt-3 pr-2.5 text-right text-micro leading-5">
          <span
            className={
              isRunning ? "text-accent" : done ? "text-faint" : "text-ink"
            }
          >
            {formatClock(placed.startMin)}
          </span>
        </div>

        {/* rail: the thread runs through the block, the marker knots it */}
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 left-1/2 w-[3px] -translate-x-1/2"
            style={{
              background: accent,
              opacity: done ? 0.3 : isMissed ? 0.35 : 0.9,
            }}
          />

          <button
            type="button"
            onClick={() => onToggleDone(block.id)}
            aria-label={
              done ? `Reopen ${block.title}` : `Complete ${block.title}`
            }
            aria-pressed={done}
            // Centred on the first line of text and sized for a thumb. z-20
            // keeps it above the neighbouring segment, which would otherwise
            // take the tap where the two areas meet.
            className="absolute left-1/2 z-20 flex h-10 w-10 -translate-x-1/2 items-center justify-center"
            style={{ top: 2 }}
          >
            <motion.span
              className="flex h-[18px] w-[18px] items-center justify-center rounded-plate"
              animate={{ scale: done ? 1 : 0.92 }}
              whileTap={{ scale: 0.82 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              style={{
                background: done ? accent : "var(--color-paper)",
                boxShadow: `inset 0 0 0 1.5px ${
                  isMissed ? "var(--color-over)" : accent
                }`,
              }}
            >
              {done && <Icon name="check" size={11} className="text-paper" />}
            </motion.span>
            {isRunning && (
              <span
                className="pulse-ring pointer-events-none absolute h-[18px] w-[18px] rounded-plate"
                style={{ boxShadow: `0 0 0 1.5px ${accent}` }}
              />
            )}
          </button>
        </div>

        {/* body — opens the sheet. The marker sits above this at z-20, so
            closing a block never accidentally opens its editor. */}
        <button
          type="button"
          onClick={() => onOpen(block.id)}
          className="min-w-0 pt-3 pr-2 text-left"
        >
          <div
            className={`truncate text-lede leading-5 ${
              done ? "text-faint" : isRunning ? "text-deep" : "text-ink"
            }`}
          >
            {block.title}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-fine leading-none">
            {thread && (
              <span className="flex min-w-0 items-center gap-1.5 text-faint">
                <span
                  className="inline-block h-[2px] w-3 shrink-0"
                  style={{ background: colour }}
                />
                <span className="truncate">{thread.name}</span>
              </span>
            )}
            {isMissed && <span className="shrink-0 text-over">missed</span>}
            {isRunning && overrunMin > 0 && (
              <span className="num shrink-0 text-over">
                {formatDuration(overrunMin)} over
              </span>
            )}
          </div>
        </button>

        {/* duration, and what the block gave back */}
        <div className="flex flex-col items-end gap-1 pt-3">
          <div className="flex items-center gap-1.5">
            {block.kind === "anchor" && (
              <Icon
                name="anchor"
                size={13}
                className={isMissed ? "text-over" : "text-faint"}
              />
            )}
            <span
              className={`num text-micro leading-5 ${
                done ? "text-faint" : "text-ink"
              }`}
            >
              {formatDuration(block.plannedMin)}
            </span>
          </div>

          {/* The payoff of the ribbon, shown on the block that produced it
              rather than floating on the boundary between two blocks — where
              it used to land on top of the next title. */}
          {slackMin > 0 && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className="num flex items-center gap-1 text-micro text-accent"
            >
              <svg
                width="9"
                height="10"
                viewBox="0 0 9 10"
                fill="none"
                aria-hidden
              >
                <path
                  d="M4.5 9.5V1M1 4.5 4.5 1 8 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {formatDuration(slackMin)}
            </motion.span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
