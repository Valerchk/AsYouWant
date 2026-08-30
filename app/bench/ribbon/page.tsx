"use client";

import { useState } from "react";
import { Ribbon } from "@/components/timeline/Ribbon";
import { QuickAdd } from "@/components/QuickAdd";
import { parseQuickAdd } from "@/lib/parse/quickAdd";
import { layout, type Block } from "@/lib/timeline/engine";
import { closeBlock, reopenBlock } from "@/lib/timeline/actions";
import { formatClock, formatDuration } from "@/lib/time";
import type { Thread } from "@/lib/threads";
import { newId } from "@/lib/store/local";

/* Ribbon bench. The time scrubber is the point: drag it and the whole day
   replays — blocks start, overrun, spill into overflow — in seconds rather
   than in real time. Nothing here talks to a database. */

const DAY_START = 8 * 60;
const DAY_END = 22 * 60;

const THREADS: Thread[] = [
  { id: "t1", name: "Thesis", colorIndex: 0 },
  { id: "t2", name: "Work", colorIndex: 3 },
  { id: "t3", name: "Health", colorIndex: 2 },
  { id: "t4", name: "Reading", colorIndex: 5 },
];

const SEED: Block[] = [
  {
    id: "s1",
    title: "Thesis — chapter 3",
    kind: "flow",
    startMin: null,
    plannedMin: 90,
    status: "planned",
    sortOrder: 1,
    threadId: "t1",
    actualStartMin: null,
    actualEndMin: null,
  },
  {
    id: "s2",
    title: "Standup",
    kind: "anchor",
    startMin: 11 * 60,
    plannedMin: 30,
    status: "planned",
    sortOrder: 2,
    threadId: "t2",
    actualStartMin: null,
    actualEndMin: null,
  },
  {
    id: "s3",
    title: "Review PRs",
    kind: "flow",
    startMin: null,
    plannedMin: 45,
    status: "planned",
    sortOrder: 3,
    threadId: "t2",
    actualStartMin: null,
    actualEndMin: null,
  },
  {
    id: "s4",
    title: "Gym",
    kind: "anchor",
    startMin: 18 * 60 + 30,
    plannedMin: 60,
    status: "planned",
    sortOrder: 4,
    threadId: "t3",
    actualStartMin: null,
    actualEndMin: null,
  },
  {
    id: "s5",
    title: "Read — Perec",
    kind: "flow",
    startMin: null,
    plannedMin: 40,
    status: "planned",
    sortOrder: 5,
    threadId: "t4",
    actualStartMin: null,
    actualEndMin: null,
  },
];

export default function RibbonBench() {
  const [blocks, setBlocks] = useState<Block[]>(SEED);
  const [nowMin, setNowMin] = useState(9 * 60 + 20);

  const result = layout(blocks, {
    nowMin,
    dayStartMin: DAY_START,
    dayEndMin: DAY_END,
  });

  function toggleDone(id: string) {
    const seg = result.placed.find((p) => p.block.id === id);
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        if (b.status === "done") return reopenBlock(b);
        return closeBlock(b, seg?.startMin ?? nowMin, nowMin);
      }),
    );
  }

  function start(id: string) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id
          ? { ...b, status: "active", actualStartMin: nowMin }
          : b.status === "active"
            ? { ...b, status: "planned", actualStartMin: null }
            : b,
      ),
    );
  }

  function add(input: string) {
    const { parsed } = parseQuickAdd(input);
    const thread =
      THREADS.find(
        (t) => t.name.toLowerCase() === parsed.threadName?.toLowerCase(),
      ) ?? null;

    setBlocks((prev) => [
      ...prev,
      {
        id: newId(),
        title: parsed.title,
        kind: parsed.kind,
        startMin: parsed.startMin,
        plannedMin: parsed.plannedMin,
        status: "planned",
        sortOrder: prev.length + 1,
        threadId: thread?.id ?? null,
        actualStartMin: null,
        actualEndMin: null,
      },
    ]);
  }

  function fillGap(startMin: number) {
    setBlocks((prev) => [
      ...prev,
      {
        id: newId(),
        title: "New block",
        kind: "anchor",
        startMin,
        plannedMin: 30,
        status: "planned",
        sortOrder: prev.length + 1,
        threadId: null,
        actualStartMin: null,
        actualEndMin: null,
      },
    ]);
  }

  const setStatus = (id: string, status: Block["status"]) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));

  const running = result.running;

  return (
    <main className="chrome safe-top safe-bottom mx-auto max-w-2xl px-5 py-10">
      <header className="mb-6">
        <h1 className="display text-title text-deep">Ribbon</h1>
        <p className="mt-1 text-fine text-faint">
          Bench · drag the scrubber to replay the day
        </p>
      </header>

      {/* scrubber */}
      <div className="mb-8 rounded-plate bg-sunk/60 p-4 rule">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-micro tracking-[0.18em] text-faint uppercase">
            Now
          </span>
          <span className="num text-lede text-accent">{formatClock(nowMin)}</span>
        </div>
        <input
          type="range"
          min={DAY_START}
          max={DAY_END}
          step={5}
          value={nowMin}
          onChange={(e) => setNowMin(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)]"
          aria-label="Scrub time of day"
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-faint">
          <span className="num">
            free <span className="text-ink">{formatDuration(result.freeMin)}</span>
          </span>
          <span className="num">
            placed <span className="text-ink">{result.placed.length}</span>
          </span>
          <span className="num">
            overflow{" "}
            <span className={result.overflow.length ? "text-over" : "text-ink"}>
              {result.overflow.length}
            </span>
          </span>
          {running && (
            <span className="num text-accent">running · {running.block.title}</span>
          )}
        </div>

        {/* starting a block is not a ribbon gesture yet — bench-only control */}
        <div className="mt-3 flex flex-wrap gap-2">
          {result.placed
            .filter((p) => p.block.status === "planned")
            .slice(0, 4)
            .map((p) => (
              <button
                key={p.block.id}
                onClick={() => start(p.block.id)}
                className="rounded-edge px-2 py-1 text-micro text-faint ring-1 ring-rule transition-colors hover:text-accent hover:ring-accent/40"
              >
                start · {p.block.title}
              </button>
            ))}
        </div>
      </div>

      <Ribbon
        blocks={blocks}
        threads={THREADS}
        nowMin={nowMin}
        dayStartMin={DAY_START}
        dayEndMin={DAY_END}
        onToggleDone={toggleDone}
        onOpenBlock={() => {}}
        onMoveBlock={(id, startMin) =>
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === id ? { ...b, kind: "anchor", startMin } : b,
            ),
          )
        }
        onFillGap={fillGap}
        onPushToTomorrow={(id) => setStatus(id, "carried")}
        onDrop={(id) => setStatus(id, "dropped")}
      />

      <div className="mt-10">
        <QuickAdd threads={THREADS} onSubmit={add} />
      </div>
    </main>
  );
}
