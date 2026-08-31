"use client";

import { useMemo, useState } from "react";
import { layout, type Block } from "@/lib/timeline/engine";
import { buildGeometry, minuteForY, yForMinute } from "@/lib/timeline/geometry";
import { threadById, type Thread } from "@/lib/threads";
import { BlockRow, type DragPreview } from "./BlockRow";
import { GapStrip } from "./GapStrip";
import { PastStrip } from "./PastStrip";
import { NowLine } from "./NowLine";
import { OverflowTray } from "./OverflowTray";
import { DragGhost } from "./DragGhost";
import { CLOCK_W, RAIL_W } from "./motion";

interface Props {
  blocks: Block[];
  threads: Thread[];
  nowMin: number;
  dayStartMin: number;
  dayEndMin: number;
  /** False for any day but today: you cannot start a block on Thursday. */
  isToday: boolean;
  onToggleDone: (blockId: string) => void;
  onStart: (blockId: string) => void;
  onOpenBlock: (blockId: string) => void;
  /** The goal's mark on a block was tapped. */
  onOpenThread: (threadId: string) => void;
  /** A stretch of open time was tapped: start a block of this length here. */
  onFillGap: (startMin: number, minutes: number) => void;
  onPushToTomorrow: (blockId: string) => void;
  onDrop: (blockId: string) => void;
  /** An anchor was dragged to a new time. */
  onMoveBlock: (blockId: string, startMin: number) => void;
  /** A flow block was dragged to a new place in the queue. */
  onReorderBlock: (blockId: string, targetMin: number) => void;
}

export function Ribbon({
  blocks,
  threads,
  nowMin,
  dayStartMin,
  dayEndMin,
  isToday,
  onToggleDone,
  onStart,
  onOpenBlock,
  onOpenThread,
  onFillGap,
  onPushToTomorrow,
  onDrop,
  onMoveBlock,
  onReorderBlock,
}: Props) {
  // The past is folded by default and expands on demand. Kept here rather than
  // in geometry so the geometry stays a pure function of the day.
  const [showPast, setShowPast] = useState(false);
  // Where a dragged block would land. Drawn as a ghost so the gesture answers
  // "where does this go" before you let go of it.
  const [ghost, setGhost] = useState<DragPreview | null>(null);

  const result = useMemo(
    () => layout(blocks, { nowMin, dayStartMin, dayEndMin }),
    [blocks, nowMin, dayStartMin, dayEndMin],
  );

  const geo = useMemo(
    () =>
      buildGeometry(result, dayStartMin, dayEndMin, {
        nowMin,
        collapsePast: !showPast,
      }),
    [result, dayStartMin, dayEndMin, nowMin, showPast],
  );

  // Slack belongs to the block that released it, so it travels with the block
  // rather than floating on the boundary between two of them.
  const slackByBlock = useMemo(
    () => new Map(result.slack.map((s) => [s.afterId, s.minutes] as const)),
    [result.slack],
  );

  /* The one block that may be started. It is the block the plan says you
     should be in right now — and only while nothing else is running, so the
     ribbon can never offer two. */
  const startableId = useMemo(() => {
    if (!isToday || result.running) return null;
    const owner = result.placed.find(
      (p) =>
        p.block.status === "planned" &&
        !p.block.external &&
        p.startMin <= nowMin &&
        nowMin < p.endMin,
    );
    return owner?.block.id ?? null;
  }, [isToday, result.running, result.placed, nowMin]);

  const nowY = yForMinute(geo, nowMin);
  const nothingPlanned =
    result.placed.length === 0 && result.overflow.length === 0;

  return (
    <div>
      <div className="relative" style={{ height: geo.totalHeight }}>
        {/* The rail's ground line, behind everything, spanning the whole day. */}
        <div
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: CLOCK_W + RAIL_W / 2,
            background: "var(--color-grid)",
          }}
        />

        {isToday && nowMin >= geo.startMin && nowMin <= geo.endMin && (
          <NowLine y={nowY} nowMin={nowMin} />
        )}

        {ghost && (
          <DragGhost geo={geo} startMin={ghost.min} mode={ghost.mode} />
        )}

        {geo.segments.map((seg) => {
          if (seg.type === "block") {
            return (
              <BlockRow
                key={seg.key}
                segment={seg}
                nowMin={nowMin}
                thread={threadById(threads, seg.placed.block.threadId)}
                slackMin={slackByBlock.get(seg.placed.block.id) ?? 0}
                startable={startableId === seg.placed.block.id}
                onToggleDone={onToggleDone}
                onStart={onStart}
                onOpen={onOpenBlock}
                onOpenThread={onOpenThread}
                minuteAt={(offsetY) => minuteForY(geo, seg.top + offsetY)}
                onMove={onMoveBlock}
                onReorder={onReorderBlock}
                onDragPreview={setGhost}
              />
            );
          }
          if (seg.type === "past") {
            return (
              <PastStrip
                key={seg.key}
                segment={seg}
                onExpand={() => setShowPast(true)}
              />
            );
          }
          return (
            <GapStrip
              key={seg.key}
              segment={seg}
              nowMin={nowMin}
              onFill={onFillGap}
            />
          );
        })}
      </div>

      {/* The first thing anyone ever sees. It used to be one grey sentence,
          which told a new person nothing about what makes this different from
          a list — and left them to work out the two kinds of block by
          experiment, or by asking. Two examples in the field's own syntax do
          that in three lines and without a tour. */}
      {nothingPlanned && (
        <div
          className="mt-4 max-w-sm"
          style={{ marginLeft: CLOCK_W + RAIL_W }}
        >
          <p className="text-base leading-7 text-ink">
            Nothing here yet. Write what you want to do in the field below — a
            time is optional.
          </p>
          <div className="mt-4 space-y-2.5">
            <Example text="Lake walk 45m" says="finds its own place" />
            <Example text="Standup at 11" says="held at eleven" />
          </div>
          <p className="mt-4 text-fine leading-6 text-faint">
            Things without an hour arrange themselves around the things that
            have one, and move when the day moves.
          </p>
        </div>
      )}

      {showPast && (
        <button
          type="button"
          onClick={() => setShowPast(false)}
          className="mt-4 text-micro text-faint transition-colors hover:text-ink"
          style={{ marginLeft: CLOCK_W + RAIL_W }}
        >
          Fold earlier today away
        </button>
      )}

      <OverflowTray
        blocks={result.overflow}
        threads={threads}
        onPushToTomorrow={onPushToTomorrow}
        onDrop={onDrop}
      />
    </div>
  );
}

/** One line of the empty day's example: what you type, and what it does. */
function Example({ text, says }: { text: string; says: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <code className="num rounded-edge bg-sunk px-2 py-1 text-fine text-deep ring-1 ring-rule">
        {text}
      </code>
      <span className="text-micro text-faint">{says}</span>
    </div>
  );
}
