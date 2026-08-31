"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sheet } from "@/components/Sheet";
import { Icon } from "@/components/icons/Icon";
import { GoalIcon, isGoalIcon } from "@/components/icons/GoalIcon";
import { formatDuration } from "@/lib/time";
import { threadColor, type Thread } from "@/lib/threads";

/* Every goal, at once.

   The row this replaces scrolled sideways, which meant that past the third
   goal the rest existed only for whoever thought to drag. A list has no far
   end: however many there are, they are all on the screen, one under another,
   with what each has actually had this week beside it.

   Nothing is assigned from here. Choosing a goal for a block happens in the
   composer, in the same breath as writing the block; this is the place you
   come to look, and to change how a goal looks or what you owe it. */

interface Props {
  open: boolean;
  threads: Thread[];
  /** Minutes per goal over the last seven days, keyed by goal id. */
  week: Map<string, number>;
  onClose: () => void;
  onOpenGoal: (threadId: string) => void;
  onCreate: (name: string) => Promise<Thread>;
}

export function GoalsSheet({ open, ...rest }: Props) {
  return (
    <AnimatePresence>{open && <SheetBody {...rest} />}</AnimatePresence>
  );
}

function SheetBody({
  threads,
  week,
  onClose,
  onOpenGoal,
  onCreate,
}: Omit<Props, "open">) {
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");

  const total = threads.reduce((sum, t) => sum + (week.get(t.id) ?? 0), 0);

  function create() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    setNaming(false);
    onCreate(name).catch(() => {
      // Already on screen: useDay puts the store's error where the day was.
    });
  }

  return (
    <Sheet label="Goals" onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="display text-lede text-deep">What the days are for</h2>
          <p className="num mt-1 text-micro text-faint">
            {total > 0 ? `${formatDuration(total)} closed this week` : "nothing closed this week"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-faint transition-colors hover:text-ink"
        >
          <Icon name="close" size={17} />
        </button>
      </div>

      <ul className="mt-5">
        {threads.map((t) => {
          const colour = threadColor(t.colorIndex);
          const spent = week.get(t.id) ?? 0;
          const target = t.weeklyTargetMin ?? 0;
          const ratio = target > 0 ? Math.min(1, spent / target) : 0;
          // Without a target, the bar reads against the busiest goal instead,
          // so the list still says which one the week actually went to.
          const share = total > 0 ? spent / total : 0;

          return (
            <li key={t.id} className="border-b border-grid">
              <button
                type="button"
                onClick={() => onOpenGoal(t.id)}
                className="flex w-full items-center gap-3 py-3.5 text-left"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-edge"
                  style={{
                    background: `color-mix(in oklab, ${colour} 20%, var(--color-paper))`,
                  }}
                >
                  {isGoalIcon(t.icon) ? (
                    <GoalIcon name={t.icon} size={17} style={{ color: colour }} />
                  ) : (
                    <span
                      className="h-[3px] w-4"
                      style={{ background: colour }}
                    />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base text-ink">
                    {t.name}
                  </span>
                  <span className="num mt-1 block text-micro text-faint">
                    {spent > 0 ? formatDuration(spent) : "nothing"}
                    {target > 0 && ` of ${formatDuration(target)}`}
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-plate bg-sunk">
                    <motion.span
                      className="block h-full"
                      style={{ background: colour }}
                      initial={false}
                      animate={{
                        width: `${(target > 0 ? ratio : share) * 100}%`,
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 34 }}
                    />
                  </span>
                </span>

                <Icon name="chevron" size={14} className="shrink-0 text-faint" />
              </button>
            </li>
          );
        })}
      </ul>

      {naming ? (
        <div className="mt-4 flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") setNaming(false);
            }}
            placeholder="Name the goal…"
            aria-label="New goal name"
            autoFocus
            className="min-w-0 flex-1 rounded-edge bg-sunk px-3 py-2.5 text-base text-deep ring-1 ring-rule outline-none focus:ring-accent/40"
          />
          <button
            type="button"
            onClick={create}
            disabled={!draft.trim()}
            className="rounded-edge bg-accent px-3 py-2.5 text-fine text-paper disabled:bg-rule disabled:text-faint"
          >
            Create
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="mt-4 flex items-center gap-2 text-fine text-accent"
        >
          <Icon name="plus" size={15} />
          New goal
        </button>
      )}

      {threads.length === 0 && !naming && (
        <p className="mt-3 text-micro text-faint">
          You do not need one to plan a day. A goal is only there for when you
          want to know where the weeks went.
        </p>
      )}
    </Sheet>
  );
}
