"use client";

import { useMemo, useState } from "react";
import { layout, type Block } from "@/lib/timeline/engine";
import { buildGeometry, minuteForY, yForMinute } from "@/lib/timeline/geometry";
import { threadById, type Thread } from "@/lib/threads";
import { BlockRow } from "./BlockRow";
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
  onToggleDone: (blockId: string) => void;
  onOpenBlock: (blockId: string) => void;
  /** A stretch of open time was tapped: start a block of this length here. */
  onFillGap: (startMin: number, minutes: number) => void;
  onPushToTomorrow: (blockId: string) => void;
  onDrop: (blockId: string) => void;
  /** A block was dragged to a new time. */
  onMoveBlock: (blockId: string, startMin: number) => void;
}

export function Ribbon({
  blocks,
  threads,
  nowMin,
  dayStartMin,
  dayEndMin,
  onToggleDone,
  onOpenBlock,
  onFillGap,
  onPushToTomorrow,
  onDrop,
  onMoveBlock,
}: Props) {
  // The past is folded by default and expands on demand. Kept here rather than
  // in geometry so the geometry stays a pure function of the day.
  const [showPast, setShowPast] = useState(false);
  // Where a dragged block would land. Drawn as a ghost so the gesture answers
  // "where does this go" before you let go of it.
  const [ghostMin, setGhostMin] = useState<number | null>(null);

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

        {nowMin >= geo.startMin && nowMin <= geo.endMin && (
          <NowLine y={nowY} nowMin={nowMin} />
        )}

        {ghostMin !== null && <DragGhost geo={geo} startMin={ghostMin} />}

        {geo.segments.map((seg) => {
          if (seg.type === "block") {
            return (
              <BlockRow
                key={seg.key}
                segment={seg}
                nowMin={nowMin}
                thread={threadById(threads, seg.placed.block.threadId)}
                slackMin={slackByBlock.get(seg.placed.block.id) ?? 0}
                onToggleDone={onToggleDone}
                onOpen={onOpenBlock}
                minuteAt={(offsetY) => minuteForY(geo, seg.top + offsetY)}
                onMove={onMoveBlock}
                onDragPreview={setGhostMin}
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

      {/* Sits below the ribbon rather than floating on top of it — the earlier
          version was absolutely positioned and landed on the gap's own label. */}
      {nothingPlanned && (
        <p
          className="mt-4 text-fine text-faint"
          style={{ marginLeft: CLOCK_W + RAIL_W }}
        >
          Nothing planned yet. Add a block below, or tap any open stretch.
        </p>
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
