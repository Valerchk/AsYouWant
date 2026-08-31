"use client";

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

   Read-only in the sense that matters: goals are neither made nor assigned
   here. Both of those happen while looking at a block, which is the only
   context in which "what is this part of" can be read at the right scale.
   This is where you come to see where the weeks went. */

interface Props {
  open: boolean;
  threads: Thread[];
  /** Minutes per goal over the last seven days, keyed by goal id. */
  week: Map<string, number>;
  onClose: () => void;
  onOpenGoal: (threadId: string) => void;
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
}: Omit<Props, "open">) {
  const total = threads.reduce((sum, t) => sum + (week.get(t.id) ?? 0), 0);

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

      {threads.length === 0 && (
        <p className="mt-2 text-base leading-7 text-faint">
          Nothing yet, and nothing to set up. A goal appears the first time you
          tell a block what it is part of — open any block on the day and the
          question is there. Until then the day works exactly as well without
          them.
        </p>
      )}

    </Sheet>
  );
}
