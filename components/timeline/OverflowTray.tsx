"use client";

import { motion, AnimatePresence } from "motion/react";
import type { Block } from "@/lib/timeline/engine";
import { formatDuration } from "@/lib/time";
import { threadColor, threadById, type Thread } from "@/lib/threads";
import { Icon } from "@/components/icons/Icon";
import { FADE_SPRING } from "./motion";

interface Props {
  blocks: Block[];
  threads: Thread[];
  onPushToTomorrow: (blockId: string) => void;
  onDrop: (blockId: string) => void;
}

/* What the day could not hold. The honesty here is the point: rather than
   quietly leaving these blocks on a plan that can no longer contain them,
   the ribbon pushes them out and asks for a decision. */

export function OverflowTray({
  blocks,
  threads,
  onPushToTomorrow,
  onDrop,
}: Props) {
  if (blocks.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={FADE_SPRING}
      className="mt-8"
    >
      <div className="mb-3 flex items-center gap-2 border-t border-over/30 pt-3">
        <Icon name="overflow" size={14} className="text-over" />
        <h2 className="text-micro tracking-[0.18em] text-over uppercase">
          Won&rsquo;t fit today
        </h2>
        <span className="num text-micro text-faint">{blocks.length}</span>
      </div>

      <ul className="space-y-px">
        <AnimatePresence initial={false}>
          {blocks.map((b) => {
            const thread = threadById(threads, b.threadId);
            return (
              <motion.li
                key={b.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={FADE_SPRING}
                className="flex items-center gap-3 bg-sunk/60 px-3 py-2.5"
              >
                <span
                  className="h-6 w-[3px] shrink-0"
                  style={{
                    background: thread
                      ? threadColor(thread.colorIndex)
                      : "var(--color-rule)",
                    opacity: 0.6,
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-base text-ink">
                  {b.title}
                </span>
                <span className="num shrink-0 text-micro text-faint">
                  {formatDuration(b.plannedMin)}
                </span>
                <button
                  type="button"
                  onClick={() => onPushToTomorrow(b.id)}
                  className="shrink-0 px-2 py-1 text-micro text-faint transition-colors hover:text-accent"
                >
                  tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => onDrop(b.id)}
                  aria-label={`Drop ${b.title}`}
                  className="shrink-0 p-1 text-faint transition-colors hover:text-over"
                >
                  <Icon name="close" size={14} />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}
