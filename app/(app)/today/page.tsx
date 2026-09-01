"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ribbon } from "@/components/timeline/Ribbon";
import {
  Composer,
  type ComposerDraft,
  type ComposerHandle,
} from "@/components/Composer";
import { DayHeader } from "@/components/DayHeader";
import { DayMenu } from "@/components/DayMenu";
import { InstallGate } from "@/components/InstallGate";
import { BlockSheet } from "@/components/BlockSheet";
import { TemplateSheet } from "@/components/TemplateSheet";
import { LoadFailure } from "@/components/LoadFailure";
import { DaySkeleton } from "@/components/Skeleton";
import { useMeasuredHeight } from "@/lib/useMeasuredHeight";
import { parseQuickAdd } from "@/lib/parse/quickAdd";
import { layout, type Block } from "@/lib/timeline/engine";
import {
  closeBlock,
  pauseBlock,
  reopenBlock,
  startBlock,
} from "@/lib/timeline/actions";
import { addDays, formatClock, formatDuration, localDay, weekOf } from "@/lib/time";
import { useNowMin, CLOCK_NOT_READY } from "@/lib/useNow";
import { dayStore } from "@/lib/data";
import { useDay } from "@/lib/data/useDay";
import { useCalendar } from "@/lib/data/useCalendar";
import { useNotes } from "@/lib/data/useNotes";

/* The day. Everything goes through useDay, which reads from Supabase when it
   is configured and from browser storage until then — this screen never knows
   which. */

export default function Today() {
  const nowMin = useNowMin();

  // One frame before the clock exists. It used to be a blank sheet, which is
  // the flash that made every load look broken; the skeleton is the same
  // shape the day will be, so nothing jumps when it arrives.
  if (nowMin === CLOCK_NOT_READY) return <DaySkeleton />;

  return <DayScreen nowMin={nowMin} />;
}

function DayScreen({ nowMin }: { nowMin: number }) {
  const [today] = useState(() => localDay());
  const [date, setDate] = useState(today);
  const isToday = date === today;

  const {
    day,
    routines,
    loading,
    error,
    addBlock,
    addBlockWithThread,
    addBlocks,
    patchBlock,
    reorderFlow,
    carryTo,
    deleteBlock,
    addThreadNamed,
    saveRoutine,
    deleteRoutine,
    confirmDay,
  } = useDay(date, nowMin);

  const { events } = useCalendar(date);
  const [footerRef, footerH] = useMeasuredHeight<HTMLElement>();
  const composer = useRef<ComposerHandle>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Intentions live in the Inbox but belong to today; the header carries the
  // count so the ribbon never has to make room for them.
  const { notes } = useNotes();

  /* Which days of the visible week hold anything. Read once per week rather
     than per minute: the shape of a week changes far more slowly than the
     clock does. */
  const [weekCounts, setWeekCounts] = useState<Map<string, number>>(new Map());
  const visibleWeek = useMemo(() => weekOf(date), [date]);
  const weekKey = visibleWeek[0];

  useEffect(() => {
    dayStore()
      .loadCounts(weekKey, addDays(weekKey, 6))
      .then(setWeekCounts)
      .catch(() => {
        // The strip simply shows no marks.
      });
  }, [weekKey]);

  /* Calendar events occupy their hours like any anchor, so the engine has to
     see them — otherwise "free" counts time that is already spoken for. */
  const blocks = useMemo(
    () => [...(day?.blocks ?? []), ...events],
    [day?.blocks, events],
  );

  /* On any day but today the engine is handed the day's own beginning rather
     than the current minute. Otherwise Thursday's plan would be laid out
     around a moment that has nothing to do with Thursday: every anchor before
     now marked missed, every flow block pushed past the end of the day. */
  const engineNow = isToday ? nowMin : (day?.dayStartMin ?? 8 * 60);

  const result = useMemo(
    () =>
      layout(blocks, {
        nowMin: engineNow,
        dayStartMin: day?.dayStartMin ?? 8 * 60,
        dayEndMin: day?.dayEndMin ?? 22 * 60,
      }),
    [blocks, day?.dayStartMin, day?.dayEndMin, engineNow],
  );

  function handleAdd(input: string, draft: ComposerDraft) {
    const { parsed } = parseQuickAdd(input);
    const block = {
      title: parsed.title,
      kind: parsed.kind,
      startMin: parsed.startMin,
      plannedMin: parsed.plannedMin,
      status: "planned" as const,
      threadId: draft.threadId,
      actualStartMin: null,
      actualEndMin: null,
      colorIndex: draft.colorIndex,
      icon: draft.icon,
    };

    // A goal picked from the chip is already real. A #tag that names no
    // existing goal creates one, so typing stays a complete path of its own.
    if (draft.threadId) addBlock(block);
    else addBlockWithThread(block, parsed.threadName);
  }

  function toggleDone(blockId: string) {
    const block = day?.blocks.find((b) => b.id === blockId);
    if (!block) return;

    if (block.status === "done") {
      const { status, actualStartMin, actualEndMin } = reopenBlock(block);
      patchBlock(blockId, { status, actualStartMin, actualEndMin });
      return;
    }

    const placed = result.placed.find((p) => p.block.id === blockId);
    const { status, actualStartMin, actualEndMin } = closeBlock(
      block,
      placed?.startMin ?? engineNow,
      engineNow,
    );
    patchBlock(blockId, { status, actualStartMin, actualEndMin });
  }

  /* Begin a block. Whatever was running is put down first with the minutes it
     genuinely got, so the day's record stays true and only one block is ever
     running at once. */
  function start(blockId: string) {
    const running = result.running;
    if (running && running.block.id !== blockId) {
      const paused = pauseBlock(running.block, nowMin);
      patchBlock(running.block.id, {
        status: paused.status,
        actualStartMin: paused.actualStartMin,
        actualEndMin: paused.actualEndMin,
      });
    }

    const block = day?.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const started = startBlock(block, nowMin);
    patchBlock(blockId, {
      status: started.status,
      actualStartMin: started.actualStartMin,
      actualEndMin: started.actualEndMin,
    });
  }

  /* Tapping open time fills the input instead of creating a block. Silently
     minting an untitled "New block" is how three identical rows ended up on
     the ribbon — and it put them wherever the gap started, which could be
     hours in the past. */
  /* Dragging an anchor to a time is a statement about the clock. */
  function moveBlock(blockId: string, startMin: number) {
    patchBlock(blockId, {
      kind: "anchor",
      startMin: Math.max(0, Math.min(1439, startMin)),
    });
  }

  /* Dragging a flow block is a statement about the queue: it keeps flowing
     and changes only which side of its neighbours it falls on. */
  function reorderBlock(blockId: string, targetMin: number) {
    const queue = result.placed
      .filter(
        (p) =>
          p.block.kind === "flow" &&
          p.block.status === "planned" &&
          !p.block.external,
      )
      .sort((a, b) => a.startMin - b.startMin);

    const rest = queue.filter((p) => p.block.id !== blockId);
    let index = rest.findIndex((p) => targetMin < (p.startMin + p.endMin) / 2);
    if (index === -1) index = rest.length;

    reorderFlow([
      ...rest.slice(0, index).map((p) => p.block.id),
      blockId,
      ...rest.slice(index).map((p) => p.block.id),
    ]);
  }

  /* Turning a weekday on makes the block a routine; turning them all off
     retires it. The block on screen keeps its day either way. */
  const handleRepeat = useCallback(
    (block: Block, mask: number) => {
      if (mask === 0) {
        if (block.routineId) {
          deleteRoutine(block.routineId);
          patchBlock(block.id, { routineId: null });
        }
        return;
      }

      void saveRoutine(
        {
          title: block.title,
          kind: block.kind,
          startMin: block.startMin,
          plannedMin: block.plannedMin,
          threadId: block.threadId,
          repeatMask: mask,
        },
        block.routineId ?? undefined,
      )
        .then((saved) => {
          if (!block.routineId) patchBlock(block.id, { routineId: saved.id });
        })
        .catch(() => {
          // useDay has already put the failure on screen.
        });
    },
    [saveRoutine, deleteRoutine, patchBlock],
  );

  function fillGap(startMin: number, minutes: number) {
    const length = Math.min(minutes, 120);
    composer.current?.prefill(
      `${formatClock(startMin)} ${formatDuration(length)} `,
    );
  }

  function carry(blockId: string) {
    const block = day?.blocks.find((b) => b.id === blockId);
    if (block) carryTo(block, addDays(date, 1));
  }

  if (error) return <LoadFailure what="your day" message={error} />;

  if (loading || !day) return <DaySkeleton />;

  const plannedMin = day.blocks
    .filter((b) => b.status === "planned" || b.status === "active")
    .reduce((sum, b) => sum + b.plannedMin, 0);

  const editing = day.blocks.find((b) => b.id === editingId) ?? null;

  const intentions = notes.filter(
    (n) => n.plannedFor === date && n.doneAt === null,
  ).length;

  // The day on screen always knows its own count, whatever the week query
  // last saw — otherwise a block added a second ago leaves no mark.
  const counts = new Map(weekCounts);
  counts.set(
    date,
    day.blocks.filter(
      (b) => b.status !== "dropped" && b.status !== "carried",
    ).length,
  );

  return (
    <>
      <main
        className="chrome mx-auto max-w-2xl"
        // Falls back until the footer has been measured, so the first
        // paint is not a page with no room at the bottom.
        style={{ paddingBottom: (footerH || 128) + 24 }}
      >
        <DayHeader
          date={date}
          today={today}
          nowMin={nowMin}
          counts={counts}
          onPickDate={setDate}
          plannedMin={plannedMin}
          freeMin={result.freeMin}
          blockCount={result.placed.length}
          overflowCount={result.overflow.length}
          intentionCount={intentions}
          confirmed={day.confirmed}
          onConfirm={confirmDay}
          onOpenMenu={() => setMenuOpen(true)}
        />

        <div className="mt-5 px-6">
          <InstallGate />
        </div>

        <div className="mt-8 px-6">
          <Ribbon
            blocks={blocks}
            threads={day.threads}
            nowMin={engineNow}
            dayStartMin={day.dayStartMin}
            dayEndMin={day.dayEndMin}
            isToday={isToday}
            onToggleDone={toggleDone}
            onStart={start}
            onOpenBlock={setEditingId}
            onFillGap={fillGap}
            onMoveBlock={moveBlock}
            onReorderBlock={reorderBlock}
            onPushToTomorrow={carry}
            onDrop={(id) => patchBlock(id, { status: "dropped" })}
          />
        </div>
      </main>

      {/* Pinned within thumb reach, directly above the tabs. */}
      <footer
        ref={footerRef}
        className="above-tabs border-t border-rule bg-paper/92 backdrop-blur-sm"
      >
        <div className="mx-auto max-w-2xl px-6 py-3.5">
          <Composer
            ref={composer}
            threads={day.threads}
            nowMin={nowMin}
            onSubmit={handleAdd}
          />
        </div>
      </footer>

      <DayMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenTemplates={() => setTemplatesOpen(true)}
      />

      <TemplateSheet
        open={templatesOpen}
        todaysBlocks={day.blocks}
        onClose={() => setTemplatesOpen(false)}
        onApply={addBlocks}
      />

      <BlockSheet
        block={editing}
        threads={day.threads}
        routines={routines}
        canStart={isToday}
        onClose={() => setEditingId(null)}
        onPatch={patchBlock}
        onDelete={deleteBlock}
        onStart={start}
        onCarry={(b) => carryTo(b, addDays(date, 1))}
        onCreateThread={addThreadNamed}
        onRepeat={handleRepeat}
      />
    </>
  );
}
