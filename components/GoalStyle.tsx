"use client";

import { Icon } from "@/components/icons/Icon";
import { GoalIcon, GOAL_ICONS, isGoalIcon } from "@/components/icons/GoalIcon";
import { threadColor, THREAD_COLOR_COUNT, type Thread } from "@/lib/threads";

/* How a goal looks, in one place.

   It appears wherever a goal is visible — inside the composer as you create
   one, on the block sheet, and on the goal's own sheet — because the answer to
   "where do I change the colour" has to be "right here", from every screen
   that shows the colour. */

export function GoalStyle({
  thread,
  onPatch,
}: {
  thread: Thread;
  onPatch: (patch: Partial<Omit<Thread, "id">>) => void;
}) {
  return (
    <>
      <div className="mb-2 text-micro tracking-[0.18em] text-faint uppercase">
        Icon
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onPatch({ icon: null })}
          aria-label="No icon"
          aria-pressed={!isGoalIcon(thread.icon)}
          className={`flex h-9 w-9 items-center justify-center rounded-edge ring-1 transition-colors ${
            !isGoalIcon(thread.icon)
              ? "bg-accent-soft text-accent ring-accent/40"
              : "text-faint ring-rule hover:bg-sunk"
          }`}
        >
          <span className="h-[2px] w-3.5 bg-current" />
        </button>
        {GOAL_ICONS.map((name) => (
          <button
            key={name}
            type="button"
            aria-label={name}
            aria-pressed={thread.icon === name}
            onClick={() => onPatch({ icon: name })}
            className={`flex h-9 w-9 items-center justify-center rounded-edge ring-1 transition-colors ${
              thread.icon === name
                ? "bg-accent-soft text-accent ring-accent/40"
                : "text-ink ring-rule hover:bg-sunk"
            }`}
          >
            <GoalIcon name={name} size={17} />
          </button>
        ))}
      </div>

      <div className="mb-2 text-micro tracking-[0.18em] text-faint uppercase">
        Colour
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: THREAD_COLOR_COUNT }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Colour ${i + 1}`}
            aria-pressed={thread.colorIndex === i}
            onClick={() => onPatch({ colorIndex: i })}
            className="flex h-8 w-8 items-center justify-center rounded-edge transition-transform active:scale-90"
            style={{
              background: threadColor(i),
              boxShadow:
                thread.colorIndex === i
                  ? "0 0 0 2px var(--color-paper), 0 0 0 4px var(--color-deep)"
                  : undefined,
            }}
          >
            {thread.colorIndex === i && (
              <Icon name="check" size={13} className="text-paper" />
            )}
          </button>
        ))}
      </div>
    </>
  );
}
