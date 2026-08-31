"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sheet } from "@/components/Sheet";
import { GoalStyle } from "@/components/GoalStyle";
import { Icon } from "@/components/icons/Icon";
import { formatDuration } from "@/lib/time";
import { threadColor, type Thread } from "@/lib/threads";

/* One goal, everything about it.

   This replaces the Goals tab. A goal was never a screen's worth of thing —
   it is a name, a colour, an icon and how much of the week you mean to give
   it — and putting it behind a tab made it read as a step you had to complete
   before the app would let you plan anything. */

const TARGETS = [0, 60, 120, 300, 600, 900];

interface Props {
  thread: Thread | null;
  /** Minutes this goal actually got over the last seven days. */
  spentMin: number;
  /** The same seven days, one at a time, oldest first. */
  days: { date: string; byThread: Map<string, number> }[];
  onClose: () => void;
  onPatch: (id: string, patch: Partial<Omit<Thread, "id">>) => void;
  onArchive: (id: string) => void;
}

export function GoalSheet({ thread, ...rest }: Props) {
  return (
    <AnimatePresence>
      {thread && <SheetBody key={thread.id} thread={thread} {...rest} />}
    </AnimatePresence>
  );
}

function SheetBody({
  thread,
  spentMin,
  days,
  onClose,
  onPatch,
  onArchive,
}: Props & { thread: Thread }) {
  const [name, setName] = useState(thread.name);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const target = thread.weeklyTargetMin ?? 0;
  const colour = threadColor(thread.colorIndex);
  const ratio = target > 0 ? Math.min(1, spentMin / target) : 0;

  return (
    <Sheet label={`Edit ${thread.name}`} onClose={onClose}>
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-7 w-[3px] shrink-0"
          style={{ background: colour }}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim();
            if (next && next !== thread.name) onPatch(thread.id, { name: next });
            else setName(thread.name);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label="Goal name"
          className="min-w-0 flex-1 rounded-edge bg-transparent text-lede text-deep outline-none focus:bg-sunk focus:px-2 focus:py-1"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-faint transition-colors hover:text-ink"
        >
          <Icon name="close" size={17} />
        </button>
      </div>

      <p className="num mt-1 mb-6 text-micro text-faint">
        {spentMin > 0 ? formatDuration(spentMin) : "nothing"} this week
        {target > 0 && ` · of ${formatDuration(target)}`}
      </p>

      {target > 0 && (
        <div className="mb-6 h-1 overflow-hidden rounded-plate bg-sunk">
          <motion.div
            className="h-full"
            style={{ background: colour }}
            initial={false}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ type: "spring", stiffness: 260, damping: 34 }}
          />
        </div>
      )}

      {/* Seven bars, because a single weekly total hides the difference
          between an hour a day and seven hours on Sunday. */}
      {days.length > 0 && <WeekBars thread={thread} days={days} />}

      <GoalStyle
        thread={thread}
        onPatch={(patch) => onPatch(thread.id, patch)}
      />

      <div className="mt-6 mb-2 text-micro tracking-[0.18em] text-faint uppercase">
        A week should give it
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TARGETS.map((min) => (
          <button
            key={min}
            type="button"
            onClick={() =>
              onPatch(thread.id, { weeklyTargetMin: min === 0 ? null : min })
            }
            aria-pressed={target === min}
            className={`rounded-edge px-3 py-2 text-fine transition-colors ${
              target === min
                ? "bg-accent-soft text-accent ring-1 ring-accent/40"
                : "text-ink ring-1 ring-rule hover:bg-sunk"
            }`}
          >
            {min === 0 ? "No target" : formatDuration(min)}
          </button>
        ))}
      </div>

      <div className="mt-6 border-t border-grid pt-4">
        {confirmingArchive ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-fine text-ink">Retire this goal?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingArchive(false)}
                className="rounded-edge px-3 py-2 text-fine text-ink ring-1 ring-rule"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={() => {
                  onArchive(thread.id);
                  onClose();
                }}
                className="rounded-edge bg-over px-3 py-2 text-fine text-paper"
              >
                Retire
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmingArchive(true)}
              className="flex items-center gap-2 text-fine text-faint transition-colors hover:text-over"
            >
              <Icon name="close" size={14} />
              Retire this goal
            </button>
            <p className="mt-1.5 text-micro text-faint">
              Past days keep it. It just stops appearing on new blocks.
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}

/* Seven bars rather than one number: a weekly total cannot tell an hour a day
   apart from seven hours on Sunday, and those are different weeks. */
function WeekBars({
  thread,
  days,
}: {
  thread: Thread;
  days: { date: string; byThread: Map<string, number> }[];
}) {
  const values = days.map((d) => d.byThread.get(thread.id) ?? 0);
  // Floored at an hour so a single ten-minute day does not draw a full bar.
  const peak = Math.max(60, ...values);
  const colour = threadColor(thread.colorIndex);

  return (
    <div className="mb-6">
      <div className="mb-2 text-micro tracking-[0.18em] text-faint uppercase">
        The last seven days
      </div>
      <div className="flex items-end gap-1.5" style={{ height: 56 }}>
        {days.map((day, i) => (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
            <motion.div
              className="w-full rounded-t-edge"
              style={{
                background: values[i] > 0 ? colour : "var(--color-sunk)",
              }}
              initial={{ height: 0 }}
              animate={{ height: Math.max(2, (values[i] / peak) * 44) }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
            <span className="num text-micro leading-none text-faint">
              {Number(day.date.slice(8))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
