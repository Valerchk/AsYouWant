"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import type { BlockSegment } from "@/lib/timeline/geometry";
import { formatClock, formatDuration } from "@/lib/time";
import { threadColor, type Thread } from "@/lib/threads";
import { Icon } from "@/components/icons/Icon";
import { GoalIcon, isGoalIcon } from "@/components/icons/GoalIcon";
import { CLOCK_W, RAIL_W, RIBBON_SPRING } from "./motion";

export interface DragPreview {
  min: number;
  mode: "time" | "insert";
}

interface Props {
  segment: BlockSegment;
  /** Used to show how far through the running block we are. */
  nowMin: number;
  thread: Thread | null;
  /** Minutes this block handed back by finishing early. */
  slackMin: number;
  /** True for the one block that may be started right now. */
  startable: boolean;
  onToggleDone: (blockId: string) => void;
  onStart: (blockId: string) => void;
  onOpen: (blockId: string) => void;
  /** Tapping the goal's mark opens the goal, not the block. */
  onOpenThread: (threadId: string) => void;
  /** Pixel offset → the minute it lands on. Non-linear, so it comes from
      geometry rather than from dividing by a scale factor. */
  minuteAt: (offsetY: number) => number;
  /** An anchor was dragged to a time. */
  onMove: (blockId: string, startMin: number) => void;
  /** A flow block was dragged to a place in the queue. */
  onReorder: (blockId: string, targetMin: number) => void;
  onDragPreview: (preview: DragPreview | null) => void;
}

export function BlockRow({
  segment,
  nowMin,
  thread,
  slackMin,
  startable,
  onToggleDone,
  onStart,
  onOpen,
  onOpenThread,
  minuteAt,
  onMove,
  onReorder,
  onDragPreview,
}: Props) {
  const { placed, top, height } = segment;
  const { block, isRunning, isMissed, overrunMin } = placed;
  const done = block.status === "done";

  // Someone else's record of your day: it holds its hour so free time stays
  // honest, and nothing here may change it.
  const external = block.external === true;

  // Finished and running blocks are history: dragging them would rewrite what
  // already happened. Only what is still planned can be moved.
  const draggable = block.status === "planned" && !external;

  /* An anchor lives on the clock, so dragging it changes when. A flow block
     lives in a queue, so dragging it changes the order — which is the whole
     point of a flow block, and used to be impossible: the gesture pinned it
     to a time and it stopped flowing forever. */
  const dragMode: DragPreview["mode"] =
    block.kind === "anchor" ? "time" : "insert";

  // The block that owns this minute. The now-line no longer crosses the
  // titles, so the current block has to say so itself.
  const holdsNow =
    placed.startMin <= nowMin && nowMin < placed.endMin && !done;
  const progress = holdsNow
    ? Math.min(1, (nowMin - placed.startMin) / Math.max(1, placed.endMin - placed.startMin))
    : 0;
  const [dragMin, setDragMin] = useState<number | null>(null);
  // Motion fires a click after a drag; without this, letting go of a block
  // would also open its editor.
  const moved = useRef(false);

  const colour = thread ? threadColor(thread.colorIndex) : "var(--color-rule)";
  const accent = isRunning
    ? overrunMin > 0
      ? "var(--color-over)"
      : "var(--color-accent)"
    : colour;

  /* The block is filled with its goal's colour, which is what lets a day be
     read as a distribution of time from across the room — and what made a
     separate row of goals unnecessary.

     Mixed with paper rather than laid down at full strength, and that is not
     timidity: in the light theme the palette runs to mid tones (#b0741c,
     #2a6fa8) where white text falls to about 3:1, and in the dark theme the
     same threads are pale (#e0a94d) where ink text fails instead. One mix
     keeps every one of the sixteen readable in both themes without a second
     hand-tuned token per colour. Full strength is spent where it costs
     nothing: the thread on the rail, the goal's icon, the progress line. */
  const strength = done ? 10 : holdsNow ? 30 : 20;
  const fill = external
    ? "transparent"
    : thread
      ? `color-mix(in oklab, ${colour} ${strength}%, var(--color-paper))`
      : done
        ? "transparent"
        : "var(--color-sunk)";

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
      animate={{ opacity: dragMin !== null ? 0.35 : 1 }}
    >
      {/* The block itself. Inset by a pixel top and bottom so two blocks that
          abut in time keep a seam of paper between them rather than merging
          into one field of colour. */}
      <div
        className="pointer-events-none absolute rounded-edge"
        style={{
          left: CLOCK_W + RAIL_W,
          right: 0,
          top: 1,
          bottom: 1,
          background: fill,
          // Somebody else's record of the day: outlined, never filled.
          boxShadow: external
            ? "inset 0 0 0 1px var(--color-grid)"
            : undefined,
        }}
      />

      {/* How much of it has gone. One thin line, along the bottom edge of the
          block, at the colour's full strength. */}
      {holdsNow && (
        <div
          className="pointer-events-none absolute right-0 h-[2px]"
          style={{
            left: CLOCK_W + RAIL_W,
            bottom: 1,
            background: "var(--color-rule)",
          }}
        >
          <motion.div
            className="h-full"
            style={{ background: accent }}
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: "spring", stiffness: 160, damping: 30 }}
          />
        </div>
      )}

      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: `${CLOCK_W}px ${RAIL_W}px minmax(0,1fr) auto`,
        }}
      >
        {/* clock — right-aligned so colons line up down the whole day.

            A block with no hour of its own is printed with a tilde: it starts
            about then, and will start somewhere else if the morning slips.
            One character does the work the words "anchored" and "flows" were
            failing to do. */}
        <div className="num pt-3 pr-2.5 text-right text-micro leading-5">
          <span
            className={
              isRunning ? "text-accent" : done || external ? "text-faint" : "text-ink"
            }
          >
            {block.kind === "flow" && !done && (
              <span className="text-faint">~</span>
            )}
            {formatClock(placed.startMin)}
          </span>
        </div>

        {/* rail: the thread runs through the block, the marker knots it */}
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 left-1/2 w-[3px] -translate-x-1/2"
            style={{
              background: external ? "none" : accent,
              backgroundImage: external
                ? "repeating-linear-gradient(to bottom, var(--color-rule) 0 4px, transparent 4px 8px)"
                : undefined,
              opacity: done ? 0.3 : isMissed ? 0.35 : 0.9,
            }}
          />

          {!external && (
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
          )}
        </div>

        {/* body — opens the sheet. The marker sits above this at z-20, so
            closing a block never accidentally opens its editor.

            The tap area is a button behind the text rather than around it,
            because the goal's mark and the start control inside need to be
            their own buttons and HTML will not nest one button in another.
            Everything above it is transparent to taps except those. */}
        <div className="relative min-w-0 pt-3 pr-2">
          {!external && (
            <button
              type="button"
              onClick={() => {
                if (!moved.current) onOpen(block.id);
              }}
              aria-label={`Open ${block.title}`}
              className="absolute inset-0"
            />
          )}

          <div
            className={`pointer-events-none relative truncate text-lede leading-5 ${
              done || external ? "text-faint" : isRunning ? "text-deep" : "text-ink"
            }`}
          >
            {block.title}
          </div>
          <div className="pointer-events-none relative mt-1.5 flex items-center gap-2 text-fine leading-none">
            {external ? (
              <span className="flex items-center gap-1.5 text-faint">
                <Icon name="crossSection" size={12} className="shrink-0" />
                <span className="truncate">calendar</span>
              </span>
            ) : (
              thread && (
                <button
                  type="button"
                  onClick={() => onOpenThread(thread.id)}
                  aria-label={`Open ${thread.name}`}
                  className="pointer-events-auto flex min-w-0 items-center gap-1.5 text-faint transition-colors hover:text-ink"
                >
                  {/* No coloured dash beside the name any more: the block is
                      already that colour, and the mark was saying it twice. */}
                  {isGoalIcon(thread.icon) && (
                    <GoalIcon
                      name={thread.icon}
                      size={13}
                      className="shrink-0"
                      style={{ color: colour }}
                    />
                  )}
                  <span className="truncate">{thread.name}</span>
                </button>
              )
            )}

            {isMissed && <span className="shrink-0 text-over">missed</span>}
            {isRunning && overrunMin > 0 && (
              <span className="num shrink-0 text-over">
                {formatDuration(overrunMin)} over
              </span>
            )}

            {/* The verb the app was missing. It appears on the one block that
                owns this minute, so the ribbon never carries more than one. */}
            {startable && (
              <button
                type="button"
                onClick={() => onStart(block.id)}
                className="pointer-events-auto ml-auto flex shrink-0 items-center gap-1 rounded-edge bg-accent-soft px-2 py-1 text-micro text-accent ring-1 ring-accent/40 transition-colors hover:bg-accent hover:text-paper"
              >
                <svg width="9" height="10" viewBox="0 0 9 10" fill="none" aria-hidden>
                  <path
                    d="M1 1v8l7-4z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="miter"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                Start
              </button>
            )}

            {isRunning && (
              <span className="num ml-auto shrink-0 text-micro text-accent">
                {formatDuration(Math.max(0, nowMin - placed.startMin))} in
              </span>
            )}
          </div>
        </div>

        {/* duration, what the block gave back, and the drag handle */}
        <div className="flex flex-col items-end gap-1 pt-3">
          <div className="flex items-center gap-1.5">
            {/* The anchor icon used to sit here saying "this one is fixed".
                The tilde in the clock gutter says it, by its absence. */}
            <span
              className={`num text-micro leading-5 ${
                done || external ? "text-faint" : "text-ink"
              }`}
            >
              {formatDuration(placed.endMin - placed.startMin)}
            </span>

            {/* Dragging is a deliberate grab, not something the whole row
                does. Grabbing the body meant every attempt to scroll risked
                moving a block, and nothing said the gesture existed. */}
            {draggable && (
              <motion.button
                type="button"
                aria-label={
                  dragMode === "time"
                    ? `Move ${block.title} to another time`
                    : `Reorder ${block.title}`
                }
                className="-mr-1 flex h-9 w-7 cursor-grab touch-none items-center justify-center text-faint active:cursor-grabbing"
                drag="y"
                dragMomentum={false}
                dragElastic={0}
                dragConstraints={{ top: 0, bottom: 0 }}
                onDragStart={() => {
                  moved.current = true;
                }}
                onDrag={(_, info) => {
                  const m = Math.round(minuteAt(info.offset.y) / 15) * 15;
                  setDragMin(m);
                  onDragPreview({ min: m, mode: dragMode });
                }}
                onDragEnd={(_, info) => {
                  // Fifteen minutes, not five: five is about seven pixels on a
                  // phone, which no thumb can aim at.
                  const raw = minuteAt(info.offset.y);
                  const target = Math.round(raw / 15) * 15;
                  if (dragMode === "time") onMove(block.id, target);
                  else onReorder(block.id, target);
                  setDragMin(null);
                  onDragPreview(null);
                  setTimeout(() => {
                    moved.current = false;
                  }, 0);
                }}
                whileDrag={{ scale: 1.2, color: "var(--color-accent)" }}
              >
                <Icon name="drag" size={15} />
              </motion.button>
            )}
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
