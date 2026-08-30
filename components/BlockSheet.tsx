"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "@/components/icons/Icon";
import { GoalIcon, GOAL_ICONS, isGoalIcon } from "@/components/icons/GoalIcon";
import { formatClock, formatDuration } from "@/lib/time";
import { threadColor, THREAD_COLOR_COUNT, type Thread } from "@/lib/threads";
import type { Block } from "@/lib/timeline/engine";

/* Everything you can do to one block, in a sheet that rises from where the
   thumb already is.

   Edits apply immediately rather than behind a Save button: the ribbon is
   right there under the sheet, so you watch the day rearrange as you change
   the numbers, and there is nothing to commit or cancel. */

const DURATIONS = [15, 30, 45, 60, 90, 120];

interface Props {
  block: Block | null;
  threads: Thread[];
  onClose: () => void;
  onPatch: (id: string, patch: Partial<Block>) => void;
  onDelete: (id: string) => void;
  onPatchThread: (id: string, patch: Partial<Omit<Thread, "id">>) => void;
}

export function BlockSheet({ block, ...rest }: Props) {
  return (
    <AnimatePresence>
      {/* Keyed by block id so opening a different block builds a fresh body:
          the draft title and the delete confirmation reset because the
          component is new, not because an effect cleared them. */}
      {block && <SheetBody key={block.id} block={block} {...rest} />}
    </AnimatePresence>
  );
}

function SheetBody({
  block,
  threads,
  onClose,
  onPatch,
  onDelete,
  onPatchThread,
}: Props & { block: Block }) {
  const [title, setTitle] = useState(block.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const thread = threads.find((t) => t.id === block.threadId) ?? null;

  function commitTitle() {
    const next = title.trim();
    if (next && next !== block.title) onPatch(block.id, { title: next });
    else setTitle(block.title);
  }

  return (
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
        aria-label={`Edit ${block.title}`}
        className="safe-bottom fixed inset-x-0 bottom-0 z-50 rounded-t-plate border-t border-rule bg-paper shadow-lift"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          // A flick downward dismisses, the way every sheet on the phone does.
          if (info.offset.y > 90 || info.velocity.y > 600) onClose();
        }}
      >
        <div className="mx-auto max-w-2xl px-6 pt-3 pb-6">
          {/* grab handle */}
          <div className="mx-auto mb-4 h-1 w-10 rounded-plate bg-rule" />

          <div className="flex items-start gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              aria-label="Block title"
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

          {/* ---- duration ---- */}
          <Section label="Duration">
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((min) => (
                <Chip
                  key={min}
                  active={block.plannedMin === min}
                  onClick={() => onPatch(block.id, { plannedMin: min })}
                >
                  {formatDuration(min)}
                </Chip>
              ))}
            </div>
          </Section>

          {/* ---- anchored or flowing ---- */}
          <Section label="Time">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip
                active={block.kind === "flow"}
                onClick={() =>
                  onPatch(block.id, { kind: "flow", startMin: null })
                }
              >
                <Icon name="flow" size={13} />
                Flows
              </Chip>
              <Chip
                active={block.kind === "anchor"}
                onClick={() =>
                  onPatch(block.id, {
                    kind: "anchor",
                    startMin: block.startMin ?? 9 * 60,
                  })
                }
              >
                <Icon name="anchor" size={13} />
                Anchored
              </Chip>

              {block.kind === "anchor" && (
                <input
                  type="time"
                  value={formatClock(block.startMin ?? 0)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    if (Number.isFinite(h) && Number.isFinite(m)) {
                      onPatch(block.id, { startMin: h * 60 + m });
                    }
                  }}
                  aria-label="Start time"
                  className="num rounded-edge bg-sunk px-2.5 py-1.5 text-fine text-deep ring-1 ring-rule outline-none focus:ring-accent/40"
                />
              )}
            </div>
            <p className="mt-2 text-micro text-faint">
              {block.kind === "anchor"
                ? "Held at this time. Everything elastic moves around it."
                : "Finds its own place between the anchors."}
            </p>
          </Section>

          {/* ---- thread ---- */}
          <Section label="Goal">
            <div className="flex flex-wrap gap-1.5">
              <Chip
                active={block.threadId === null}
                onClick={() => onPatch(block.id, { threadId: null })}
              >
                None
              </Chip>
              {threads.map((t) => (
                <Chip
                  key={t.id}
                  active={block.threadId === t.id}
                  onClick={() => onPatch(block.id, { threadId: t.id })}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-plate"
                    style={{ background: threadColor(t.colorIndex) }}
                  />
                  {t.name}
                </Chip>
              ))}
            </div>

            {/* Recolouring a goal here changes it everywhere that goal
                    appears — it belongs to the goal, not to this block. */}
            {thread && (
              <div className="mt-4">
                <div className="mb-2 text-micro text-faint">
                  Icon for &ldquo;{thread.name}&rdquo;
                </div>
                <div className="mb-4 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPatchThread(thread.id, { icon: null })}
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
                      onClick={() => onPatchThread(thread.id, { icon: name })}
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

                <div className="mb-2 text-micro text-faint">
                  Colour of &ldquo;{thread.name}&rdquo;
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: THREAD_COLOR_COUNT }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Colour ${i + 1}`}
                      aria-pressed={thread.colorIndex === i}
                      onClick={() =>
                        onPatchThread(thread.id, { colorIndex: i })
                      }
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
              </div>
            )}
          </Section>

          {/* ---- destructive ---- */}
          <div className="mt-6 flex items-center justify-between border-t border-grid pt-4">
            {confirmingDelete ? (
              <div className="flex w-full items-center justify-between gap-3">
                <span className="text-fine text-ink">Delete this block?</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-edge px-3 py-2 text-fine text-ink ring-1 ring-rule"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(block.id);
                      onClose();
                    }}
                    className="rounded-edge bg-over px-3 py-2 text-fine text-paper"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="flex items-center gap-2 text-fine text-faint transition-colors hover:text-over"
                >
                  <Icon name="close" size={14} />
                  Delete
                </button>
                <span className="num text-micro text-faint">
                  {block.status}
                </span>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-micro tracking-[0.18em] text-faint uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-edge px-3 py-2 text-fine transition-colors ${
        active
          ? "bg-accent-soft text-accent ring-1 ring-accent/40"
          : "text-ink ring-1 ring-rule hover:bg-sunk"
      }`}
    >
      {children}
    </button>
  );
}
