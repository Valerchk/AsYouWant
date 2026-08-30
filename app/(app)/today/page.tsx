"use client";

import { useMemo, useRef, useState } from "react";
import { Ribbon } from "@/components/timeline/Ribbon";
import { QuickAdd, type QuickAddHandle } from "@/components/QuickAdd";
import { DayHeader } from "@/components/DayHeader";
import { InstallGate } from "@/components/InstallGate";
import { BlockSheet } from "@/components/BlockSheet";
import { TemplateSheet } from "@/components/TemplateSheet";
import { LoadFailure } from "@/components/LoadFailure";
import { parseQuickAdd } from "@/lib/parse/quickAdd";
import { layout, type Block } from "@/lib/timeline/engine";
import { closeBlock, reopenBlock } from "@/lib/timeline/actions";
import { formatClock, formatDuration } from "@/lib/time";
import { useNowMin, CLOCK_NOT_READY } from "@/lib/useNow";
import { useDay } from "@/lib/data/useDay";
import { useNotes } from "@/lib/data/useNotes";

/* The day. Everything goes through useDay, which reads from Supabase when it
   is configured and from browser storage until then — this screen never knows
   which. */

export default function Today() {
  const nowMin = useNowMin();

  // One frame before the clock exists, matching the server output exactly.
  if (nowMin === CLOCK_NOT_READY) {
    return <main className="min-h-dvh bg-paper" />;
  }

  return <DayScreen nowMin={nowMin} />;
}

function DayScreen({ nowMin }: { nowMin: number }) {
  const {
    day,
    loading,
    error,
    addBlockWithThread,
    addBlocks,
    patchBlock,
    deleteBlock,
    patchThread,
    confirmDay,
  } = useDay(nowMin);
  const quickAdd = useRef<QuickAddHandle>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Intentions live in the Inbox but belong to today; the header carries the
  // count so the ribbon never has to make room for them.
  const { notes } = useNotes();

  const result = useMemo(
    () =>
      layout(day?.blocks ?? [], {
        nowMin,
        dayStartMin: day?.dayStartMin ?? 8 * 60,
        dayEndMin: day?.dayEndMin ?? 22 * 60,
      }),
    [day?.blocks, day?.dayStartMin, day?.dayEndMin, nowMin],
  );

  function handleAdd(input: string) {
    const { parsed } = parseQuickAdd(input);
    // A #tag that names no existing goal creates one, so a fresh account is
    // not a dead end.
    addBlockWithThread(
      {
        title: parsed.title,
        kind: parsed.kind,
        startMin: parsed.startMin,
        plannedMin: parsed.plannedMin,
        status: "planned",
        threadId: null,
        actualStartMin: null,
        actualEndMin: null,
      },
      parsed.threadName,
    );
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
      placed?.startMin ?? nowMin,
      nowMin,
    );
    patchBlock(blockId, { status, actualStartMin, actualEndMin });
  }

  /* Tapping open time fills the input instead of creating a block. Silently
     minting an untitled "New block" is how three identical rows ended up on
     the ribbon — and it put them wherever the gap started, which could be
     hours in the past. */
  /* Dragging a block to a time is a statement that it belongs there, so it
     becomes anchored. A flow block that kept flowing after being placed would
     just spring back, which reads as the app refusing the gesture. */
  function moveBlock(blockId: string, startMin: number) {
    patchBlock(blockId, {
      kind: "anchor",
      startMin: Math.max(0, Math.min(1439, startMin)),
    });
  }

  function fillGap(startMin: number, minutes: number) {
    const length = Math.min(minutes, 120);
    quickAdd.current?.prefill(
      `${formatClock(startMin)} ${formatDuration(length)} `,
    );
  }

  if (error) return <LoadFailure what="your day" message={error} />;

  if (loading || !day) {
    return (
      <main className="chrome mx-auto max-w-2xl px-6 pt-7">
        <div className="num text-micro text-faint">LOADING</div>
      </main>
    );
  }

  const plannedMin = day.blocks
    .filter((b) => b.status === "planned" || b.status === "active")
    .reduce((sum, b) => sum + b.plannedMin, 0);

  const setStatus = (id: string, status: Block["status"]) =>
    patchBlock(id, { status });

  const editing = day.blocks.find((b) => b.id === editingId) ?? null;

  const intentions = notes.filter((n) => n.plannedFor === day.date).length;

  return (
    <>
      <main className="chrome mx-auto max-w-2xl pb-32">
        <DayHeader
          nowMin={nowMin}
          plannedMin={plannedMin}
          freeMin={result.freeMin}
          blockCount={result.placed.length}
          overflowCount={result.overflow.length}
          intentionCount={intentions}
          confirmed={day.confirmed}
          onConfirm={confirmDay}
          onOpenTemplates={() => setTemplatesOpen(true)}
        />

        <div className="mt-7 px-6">
          <InstallGate />
        </div>

        <div className="mt-8 px-6">
          <Ribbon
            blocks={day.blocks}
            threads={day.threads}
            nowMin={nowMin}
            dayStartMin={day.dayStartMin}
            dayEndMin={day.dayEndMin}
            onToggleDone={toggleDone}
            onOpenBlock={setEditingId}
            onFillGap={fillGap}
            onMoveBlock={moveBlock}
            onPushToTomorrow={(id) => setStatus(id, "carried")}
            onDrop={(id) => setStatus(id, "dropped")}
          />
        </div>
      </main>

      {/* Pinned within thumb reach, directly above the tabs. */}
      <footer className="above-tabs border-t border-rule bg-paper/92 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-6 py-3.5">
          <QuickAdd ref={quickAdd} threads={day.threads} onSubmit={handleAdd} />
        </div>
      </footer>

      <TemplateSheet
        open={templatesOpen}
        todaysBlocks={day.blocks}
        onClose={() => setTemplatesOpen(false)}
        onApply={addBlocks}
      />

      <BlockSheet
        block={editing}
        threads={day.threads}
        onClose={() => setEditingId(null)}
        onPatch={patchBlock}
        onDelete={deleteBlock}
        onPatchThread={patchThread}
      />
    </>
  );
}
