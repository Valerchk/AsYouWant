"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import type { BlockSegment } from "@/lib/timeline/geometry";
import { formatClock, formatDuration } from "@/lib/time";
import { lookColor, type Look } from "@/lib/blocks/look";
import { Icon } from "@/components/icons/Icon";
import { GoalIcon, isGoalIcon } from "@/components/icons/GoalIcon";
import { CLOCK_W, RAIL_W, RIBBON_SPRING } from "./motion";

/* ==========================================================================
   One block on the ribbon.
   --------------------------------------------------------------------------
   A card that states its own span. The clock gutter to its left is a ruled
   scale now rather than a column of per-block labels, so the hour a block
   occupies belongs on the block: "~22:51 – 23:21 · 30m", one line, said once.

   There is no way to start a block here, and that is deliberate. The screen
   plans a day and shows it whole; it does not ask to be told, minute by
   minute, what you are doing — an app that only tells the truth while you
   keep feeding it is an app that is wrong by Tuesday. What you do mark is
   that something happened, which is what the marker on the rail is for and
   what the Goals tab counts.
   ========================================================================== */

export interface DragPreview {
  min: number;
  mode: "time" | "insert";
}

interface Props {
  segment: BlockSegment;
  /** Used only to tell which block the clock is currently inside. */
  nowMin: number;
  /** Colour and icon, already resolved against the block's goal. */
  look: Look;
  /** Minutes this block handed back by finishing early. */
  slackMin: number;
  onToggleDone: (blockId: string) => void;
  onOpen: (blockId: string) => void;
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
  look,
  slackMin,
  onToggleDone,
  onOpen,
  minuteAt,
  onMove,
  onReorder,
  onDragPreview,
}: Props) {
  const { placed, top, height } = segment;
  const { block, isMissed } = placed;
  const done = block.status === "done";

  // Someone else's record of your day: it holds its hour so free time stays
  // honest, and nothing here may change it.
  const external = block.external === true;

  // Finished blocks are history: dragging them would rewrite what already
  // happened. Only what is still planned can be moved.
  const draggable = block.status === "planned" && !external;

  /* An anchor lives on the clock, so dragging it changes when. A flow block
     lives in a queue, so dragging it changes the order — which is the whole
     point of a flow block, and used to be impossible: the gesture pinned it
     to a time and it stopped flowing forever. */
  const dragMode: DragPreview["mode"] =
    block.kind === "anchor" ? "time" : "insert";

  /* The block the clock is inside. Not a claim that you are doing it — the
     app has no way of knowing that and no longer pretends to — but a claim
     about where you are in your own plan, which is the question this screen
     exists to answer at a glance. */
  const holdsNow = placed.startMin <= nowMin && nowMin < placed.endMin && !done;

  const [dragMin, setDragMin] = useState<number | null>(null);
  // Held from the moment the grip is taken, rather than from the first
  // movement, so the well lights up under the thumb that is already on it.
  const [grabbed, setGrabbed] = useState(false);
  // Motion fires a click after a drag; without this, letting go of a block
  // would also open its editor.
  const moved = useRef(false);

  const own = lookColor(look);
  const colour = own ?? "var(--color-rule)";

  /* The block is filled with its own colour, which is what lets a day be read
     as a distribution of time from across the room.

     Mixed with paper rather than laid down at full strength, and that is not
     timidity: in the light theme the palette runs to mid tones (#b0741c,
     #2a6fa8) where white text falls to about 3:1, and in the dark theme the
     same colours are pale (#e0a94d) where ink text fails instead. One mix
     keeps every one of the sixteen readable in both themes without a second
     hand-tuned token per colour. Full strength is spent where it costs
     nothing: the spine down the card's edge, and the icon. */
  const strength = done ? 10 : holdsNow ? 28 : 18;
  const fill = external
    ? "transparent"
    : own
      ? `color-mix(in oklab, ${own} ${strength}%, var(--color-paper))`
      : done
        ? "transparent"
        : "var(--color-sunk)";

  const panelLeft = CLOCK_W + RAIL_W;

  return (
    <motion.div
      // `top` is real CSS, not an animated transform. Carrying the position
      // only in `animate={{ y }}` meant any frame where the animation had not
      // run stacked every segment at one point, and the overlapping hit areas
      // swallowed taps. Layout must never depend on animation.
      layout
      // The day bar scrolls to a block by id; nothing else uses this.
      id={`block-${block.id}`}
      className="absolute inset-x-0 z-10 scroll-mt-24"
      style={{ top, height }}
      transition={RIBBON_SPRING}
      // Faded while in flight, so the ghost showing where it lands is the
      // brighter of the two — but not so faint that the grip under your own
      // thumb disappears, which is what 0.35 did.
      animate={{ opacity: dragMin !== null ? 0.55 : 1 }}
    >
      {/* The card. Inset by a pixel top and bottom so two blocks that abut in
          time keep a seam of paper between them rather than merging into one
          field of colour. */}
      <div
        className="pointer-events-none absolute rounded-edge"
        style={{
          left: panelLeft,
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

      {/* The spine. Full strength down the card's leading edge, where colour
          costs no legibility at all — it is what makes a day scannable by
          colour from arm's length even though the fills are gentle. */}
      {!external && own && (
        <div
          className="pointer-events-none absolute rounded-l-edge"
          style={{
            left: panelLeft,
            width: 3,
            top: 1,
            bottom: 1,
            background: colour,
            opacity: done ? 0.35 : 1,
          }}
        />
      )}

      <div
        className="grid h-full"
        style={{
          gridTemplateColumns: `${CLOCK_W}px ${RAIL_W}px minmax(0,1fr) auto`,
        }}
      >
        {/* The clock gutter belongs to the hour scale now, drawn once for the
            whole ribbon. This column is the space it occupies. */}
        <div aria-hidden />

        {/* rail: the thread runs through the block, the marker knots it */}
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 left-1/2 w-[3px] -translate-x-1/2"
            style={{
              background: external ? "none" : colour,
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
              style={{ top: 4 }}
            >
              <motion.span
                className="flex h-[18px] w-[18px] items-center justify-center rounded-plate"
                animate={{ scale: done ? 1 : 0.92 }}
                whileTap={{ scale: 0.82 }}
                transition={{ type: "spring", stiffness: 500, damping: 24 }}
                style={{
                  background: done ? colour : "var(--color-paper)",
                  boxShadow: `inset 0 0 0 1.5px ${
                    isMissed ? "var(--color-over)" : colour
                  }`,
                }}
              >
                {done && <Icon name="check" size={11} className="text-paper" />}
              </motion.span>
            </button>
          )}
        </div>

        {/* body — opens the sheet. The marker sits above this at z-20, so
            closing a block never accidentally opens its editor.

            The tap area is a button behind the text rather than around it,
            because everything drawn over it must stay transparent to taps. */}
        <div className="relative min-w-0 pt-3 pr-2 pl-3">
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
            className={`pointer-events-none relative truncate text-lede leading-6 ${
              done ? "text-faint line-through decoration-faint/50" : external ? "text-faint" : "text-deep"
            }`}
          >
            {block.title}
          </div>

          {/* The block's own span, on the block. A tilde means it has no hour
              of its own: it starts about then, and will start somewhere else
              if the morning slips. One character does the work the words
              "anchored" and "flows" were failing to do. */}
          <div className="pointer-events-none relative mt-1 flex items-center gap-2 text-micro leading-none">
            {isGoalIcon(look.icon) && !external && (
              <GoalIcon
                name={look.icon}
                size={13}
                className="shrink-0"
                style={{ color: colour }}
              />
            )}
            <span className={`num shrink-0 ${done ? "text-faint" : "text-ink"}`}>
              {block.kind === "flow" && !done && (
                <span className="text-faint">~</span>
              )}
              {formatClock(placed.startMin)}
              <span className="text-faint">–</span>
              {formatClock(placed.endMin)}
            </span>
            <span className="text-faint">·</span>
            <span className="num shrink-0 text-faint">
              {formatDuration(placed.endMin - placed.startMin)}
            </span>

            {external && (
              <span className="flex shrink-0 items-center gap-1.5 text-faint">
                <Icon name="crossSection" size={11} />
                calendar
              </span>
            )}
            {isMissed && <span className="shrink-0 text-over">missed</span>}
          </div>
        </div>

        {/* what the block gave back, and the drag handle */}
        <div className="flex flex-col items-end gap-1 pt-3">
          {/* Dragging is a deliberate grab, not something the whole row does.
              Grabbing the body meant every attempt to scroll risked moving a
              block.

              Drawn as a grip sunk into a well, because the previous version —
              two hairlines in the faintest ink the palette has — was
              indistinguishable from a rule, and a control nobody recognises as
              a control is a feature that does not exist. */}
          {draggable && (
            <motion.button
              type="button"
              aria-label={
                dragMode === "time"
                  ? `Move ${block.title} to another time`
                  : `Reorder ${block.title}`
              }
              title={
                dragMode === "time"
                  ? "Drag to another hour"
                  : "Drag to move it up or down the queue"
              }
              className="-mr-1 flex h-9 w-8 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
              drag="y"
              dragMomentum={false}
              dragElastic={0}
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragStart={() => {
                moved.current = true;
                setGrabbed(true);
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
                setGrabbed(false);
                onDragPreview(null);
                setTimeout(() => {
                  moved.current = false;
                }, 0);
              }}
              whileDrag={{ scale: 1.15 }}
            >
              <span
                className={`flex h-7 w-[26px] items-center justify-center rounded-edge ring-1 transition-colors ${
                  grabbed
                    ? "bg-accent text-paper ring-accent"
                    : "bg-paper text-ink ring-rule"
                }`}
              >
                <Icon name="grip" size={16} />
              </span>
            </motion.button>
          )}

          {/* The payoff of the ribbon, shown on the block that produced it
              rather than floating on the boundary between two blocks — where
              it used to land on top of the next title. */}
          {slackMin > 0 && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className="num flex items-center gap-1 pr-1 text-micro text-accent"
            >
              <svg width="9" height="10" viewBox="0 0 9 10" fill="none" aria-hidden>
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
