"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "@/components/icons/Icon";
import { formatClock, formatDuration } from "@/lib/time";
import { dayStore } from "@/lib/data";
import type { DayTemplate, NewBlock, TemplateBlock } from "@/lib/data/types";
import type { Block } from "@/lib/timeline/engine";

/* Saved shapes of a day.

   The point is the second week, not the first: most people's Tuesday looks a
   lot like their Monday, and retyping it every morning is the thing that
   makes planners get abandoned. */

interface Props {
  open: boolean;
  todaysBlocks: Block[];
  onClose: () => void;
  onApply: (blocks: NewBlock[]) => void;
}

/** Only the shape travels — no ids, no statuses, no actual times. */
function toTemplateBlocks(blocks: Block[]): TemplateBlock[] {
  return blocks
    .filter((b) => b.status !== "dropped" && b.status !== "carried")
    .map((b) => ({
      title: b.title,
      kind: b.kind,
      startMin: b.startMin,
      plannedMin: b.plannedMin,
      threadId: b.threadId,
    }));
}

function toNewBlocks(template: DayTemplate): NewBlock[] {
  return template.blocks.map((t) => ({
    title: t.title,
    kind: t.kind,
    startMin: t.startMin,
    plannedMin: t.plannedMin,
    status: "planned" as const,
    threadId: t.threadId,
    actualStartMin: null,
    actualEndMin: null,
  }));
}

export function TemplateSheet({ open, todaysBlocks, onClose, onApply }: Props) {
  const [templates, setTemplates] = useState<DayTemplate[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    dayStore()
      .listTemplates()
      .then(setTemplates)
      .catch(() => {
        /* an unreachable list only costs the templates, not the day */
      });
  }, []);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  const shape = toTemplateBlocks(todaysBlocks);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const label = name.trim();
    if (!label || shape.length === 0) return;
    setBusy(true);
    dayStore()
      .saveTemplate(label, shape)
      .then(() => {
        setName("");
        reload();
      })
      .finally(() => setBusy(false));
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-deep/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-label="Day templates"
            className="safe-bottom fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-plate border-t border-rule bg-paper shadow-lift"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="mx-auto max-w-2xl px-6 pt-3 pb-6">
              <div className="mx-auto mb-4 h-1 w-10 rounded-plate bg-rule" />

              <div className="flex items-center justify-between">
                <h2 className="text-lede text-deep">Day templates</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center text-faint transition-colors hover:text-ink"
                >
                  <Icon name="close" size={17} />
                </button>
              </div>

              {templates.length === 0 ? (
                <p className="mt-4 text-fine text-faint">
                  No templates yet. Shape a day the way you like it, then save
                  it here and lay it down again in one tap.
                </p>
              ) : (
                <ul className="mt-4">
                  {templates.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 border-b border-grid py-3"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onApply(toNewBlocks(t));
                          onClose();
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="block truncate text-base text-ink">
                          {t.name}
                        </span>
                        <span className="num mt-0.5 block text-micro text-faint">
                          {t.blocks.length}{" "}
                          {t.blocks.length === 1 ? "block" : "blocks"} ·{" "}
                          {formatDuration(
                            t.blocks.reduce((sum, b) => sum + b.plannedMin, 0),
                          )}
                          {t.blocks[0]?.startMin !== null &&
                            t.blocks[0]?.startMin !== undefined &&
                            ` · from ${formatClock(t.blocks[0].startMin)}`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          dayStore().deleteTemplate(t.id).then(reload)
                        }
                        aria-label={`Delete ${t.name}`}
                        className="flex h-9 w-8 shrink-0 items-center justify-center text-faint transition-colors hover:text-over"
                      >
                        <Icon name="close" size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={save} className="mt-6 border-t border-rule pt-5">
                <div className="mb-2 text-micro tracking-[0.18em] text-faint uppercase">
                  Save today as
                </div>
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Weekday"
                    aria-label="Template name"
                    className="min-w-0 flex-1 rounded-edge bg-sunk px-3 py-2.5 text-base text-deep ring-1 ring-rule outline-none placeholder:text-faint/60 focus:ring-accent/40"
                  />
                  <button
                    type="submit"
                    disabled={busy || !name.trim() || shape.length === 0}
                    className="shrink-0 rounded-edge bg-accent px-4 py-2.5 text-fine text-paper transition-shadow hover:shadow-lift disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
                <p className="mt-2 text-micro text-faint">
                  {shape.length === 0
                    ? "Nothing on today to save yet."
                    : `Stores the shape of ${shape.length} ${
                        shape.length === 1 ? "block" : "blocks"
                      } — titles, times and goals, not what got done.`}
                </p>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
