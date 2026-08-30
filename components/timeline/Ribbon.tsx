"use client";

import { useMemo } from "react";
import { layout, type Block } from "@/lib/timeline/engine";
import { buildGeometry, yForMinute } from "@/lib/timeline/geometry";
import { threadById, type Thread } from "@/lib/threads";
import { BlockRow } from "./BlockRow";
import { GapStrip } from "./GapStrip";
import { NowLine } from "./NowLine";
import { OverflowTray } from "./OverflowTray";
import { CLOCK_W, RAIL_W } from "./motion";

interface Props {
  blocks: Block[];
  threads: Thread[];
  nowMin: number;
  dayStartMin: number;
  dayEndMin: number;
  onToggleDone: (blockId: string) => void;
  onOpenBlock: (blockId: string) => void;
  onFillGap: (startMin: number, endMin: number) => void;
  onPushToTomorrow: (blockId: string) => void;
  onDrop: (blockId: string) => void;
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
}: Props) {
  const result = useMemo(
    () => layout(blocks, { nowMin, dayStartMin, dayEndMin }),
    [blocks, nowMin, dayStartMin, dayEndMin],
  );

  const geo = useMemo(
    () => buildGeometry(result, dayStartMin, dayEndMin),
    [result, dayStartMin, dayEndMin],
  );

  // Slack belongs to the block that released it, so it travels with the block
  // rather than floating on the boundary between two of them.
  const slackByBlock = useMemo(
    () => new Map(result.slack.map((s) => [s.afterId, s.minutes] as const)),
    [result.slack],
  );

  const nowY = yForMinute(geo, nowMin);
  const empty = result.placed.length === 0 && result.overflow.length === 0;

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
          <NowLine y={nowY} />
        )}

        {geo.segments.map((seg) =>
          seg.type === "block" ? (
            <BlockRow
              key={seg.key}
              segment={seg}
              thread={threadById(threads, seg.placed.block.threadId)}
              slackMin={slackByBlock.get(seg.placed.block.id) ?? 0}
              onToggleDone={onToggleDone}
              onOpen={onOpenBlock}
            />
          ) : (
            <GapStrip key={seg.key} segment={seg} onFill={onFillGap} />
          ),
        )}

        {empty && (
          <div
            className="absolute text-fine text-faint"
            style={{ left: CLOCK_W + RAIL_W, top: 12 }}
          >
            Nothing planned yet. Add a block below.
          </div>
        )}
      </div>

      <OverflowTray
        blocks={result.overflow}
        threads={threads}
        onPushToTomorrow={onPushToTomorrow}
        onDrop={onDrop}
      />
    </div>
  );
}
