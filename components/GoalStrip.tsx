"use client";

import { Icon } from "@/components/icons/Icon";
import { GoalIcon, isGoalIcon } from "@/components/icons/GoalIcon";
import { formatDuration } from "@/lib/time";
import { threadColor, type Thread } from "@/lib/threads";

/* Goals, on the screen you actually look at.

   They used to live behind a tab, which made them read as setup: something to
   be configured before the day would work. Here they are a row under the
   day's numbers — what you are giving your weeks to, and how much each has
   had. Tapping one opens it; nothing has to be visited first. */

export function GoalStrip({
  threads,
  week,
  onOpen,
  onCreate,
}: {
  threads: Thread[];
  /** Minutes per goal over the last seven days, keyed by goal id. */
  week: Map<string, number>;
  onOpen: (threadId: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {threads.map((t) => {
        const colour = threadColor(t.colorIndex);
        const spent = week.get(t.id) ?? 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpen(t.id)}
            className="flex shrink-0 items-center gap-2 rounded-edge px-2.5 py-1.5 ring-1 ring-rule transition-colors hover:bg-sunk"
          >
            {isGoalIcon(t.icon) ? (
              <GoalIcon name={t.icon} size={14} style={{ color: colour }} />
            ) : (
              <span
                className="inline-block h-[2px] w-3.5"
                style={{ background: colour }}
              />
            )}
            <span className="text-fine text-ink">{t.name}</span>
            {spent > 0 && (
              <span className="num text-micro text-faint">
                {formatDuration(spent)}
              </span>
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onCreate}
        className="flex shrink-0 items-center gap-1.5 rounded-edge px-2.5 py-1.5 text-faint ring-1 ring-rule transition-colors hover:bg-sunk hover:text-ink"
      >
        <Icon name="plus" size={14} />
        {threads.length === 0 && <span className="text-fine">Add a goal</span>}
      </button>
    </div>
  );
}
