"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { Sheet } from "@/components/Sheet";
import { GoalStyle } from "@/components/GoalStyle";
import { Icon } from "@/components/icons/Icon";
import { formatClock, formatDuration } from "@/lib/time";
import { threadColor, type Thread } from "@/lib/threads";
import {
  REPEAT_PRESETS,
  WEEKDAY_INITIALS,
  WEEKDAY_ORDER,
  describeRepeat,
  repeatsOn,
  toggleWeekday,
  type Routine,
} from "@/lib/routines";
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
  routines: Routine[];
  /** False on a past day, where starting something makes no sense. */
  canStart: boolean;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<Block>) => void;
  onDelete: (id: string) => void;
  onStart: (id: string) => void;
  onCarry: (block: Block) => void;
  onPatchThread: (id: string, patch: Partial<Omit<Thread, "id">>) => void;
  /** The only place a goal is ever born: looking at a block that needs one. */
  onCreateThread: (name: string) => Promise<Thread>;
  /** Turning any weekday on makes this block a routine. */
  onRepeat: (block: Block, mask: number) => void;
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
  routines,
  canStart,
  onClose,
  onPatch,
  onDelete,
  onStart,
  onCarry,
  onPatchThread,
  onCreateThread,
  onRepeat,
}: Props & { block: Block }) {
  const [title, setTitle] = useState(block.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");

  const thread = threads.find((t) => t.id === block.threadId) ?? null;
  const routine = routines.find((r) => r.id === block.routineId) ?? null;
  const mask = routine?.repeatMask ?? 0;

  function create() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    setNaming(false);
    onCreateThread(name)
      .then((made) => onPatch(block.id, { threadId: made.id }))
      .catch(() => {
        // Already on screen: useDay puts the store's error where the day was.
      });
  }

  function commitTitle() {
    const next = title.trim();
    if (next && next !== block.title) onPatch(block.id, { title: next });
    else setTitle(block.title);
  }

  return (
    <Sheet label={`Edit ${block.title}`} onClose={onClose}>
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

      {/* The verb, also here — the ribbon only offers it on the block that
          owns the current minute, and sometimes you start something else. */}
      {canStart && block.status === "planned" && (
        <button
          type="button"
          onClick={() => {
            onStart(block.id);
            onClose();
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-plate bg-accent px-4 py-3 text-left text-paper transition-shadow hover:shadow-lift"
        >
          <svg width="11" height="12" viewBox="0 0 9 10" fill="none" aria-hidden>
            <path
              d="M1 1v8l7-4z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="miter"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span className="text-fine">Start it now</span>
        </button>
      )}

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
      <Section label="When">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            active={block.kind === "flow"}
            onClick={() => onPatch(block.id, { kind: "flow", startMin: null })}
          >
            <Icon name="flow" size={13} />
            Anytime
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
            At a time
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
        {/* The chips answer "when"; this says what follows from the answer.
            The old labels were "Anchored" and "Flows", which needed a glossary
            nobody was given. */}
        <p className="mt-2 text-micro text-faint">
          {block.kind === "anchor"
            ? "Held at this hour whatever else moves — a meeting, a train. Everything else goes around it. Drag its handle to change the hour."
            : "No hour of its own: it takes the next opening between the fixed ones, and moves with them when the day slips. Drag its handle to change its place in the queue."}
        </p>
      </Section>

      {/* ---- repeat ---- */}
      <Section label="Repeats">
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_ORDER.map((weekday) => (
            <button
              key={weekday}
              type="button"
              aria-label={`Repeat on day ${weekday}`}
              aria-pressed={repeatsOn(mask, weekday)}
              onClick={() => onRepeat(block, toggleWeekday(mask, weekday))}
              className={`h-9 w-9 rounded-edge text-fine transition-colors ${
                repeatsOn(mask, weekday)
                  ? "bg-accent text-paper"
                  : "text-ink ring-1 ring-rule hover:bg-sunk"
              }`}
            >
              {WEEKDAY_INITIALS[weekday]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REPEAT_PRESETS.map((preset) => (
            <Chip
              key={preset.label}
              active={mask === preset.mask}
              onClick={() => onRepeat(block, preset.mask)}
            >
              {preset.label}
            </Chip>
          ))}
          {mask !== 0 && (
            <Chip active={false} onClick={() => onRepeat(block, 0)}>
              Stop repeating
            </Chip>
          )}
        </div>
        <p className="mt-2 text-micro text-faint">
          {mask === 0
            ? "Just this once."
            : `${describeRepeat(mask)} — it appears on those days by itself. Editing one day's copy leaves the others alone.`}
        </p>
      </Section>

      {/* ---- thread ----

           "Part of", not "Goal". Asked here, next to a block that already
           exists, the question can only be read at the right scale: nobody
           looking at a block called "Change my address" answers it by making
           a goal of the same name. Asked on an empty screen, with a plus and
           a row of colours, that is exactly what people answer — which is how
           a task ended up wearing a house icon and never reaching the day. */}
      <Section label="Part of">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={block.threadId === null}
            onClick={() => onPatch(block.id, { threadId: null })}
          >
            Nothing in particular
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
          {!naming && (
            <Chip active={false} onClick={() => setNaming(true)}>
              <Icon name="plus" size={13} />
              Something new
            </Chip>
          )}
        </div>

        {naming && (
          <div className="mt-2 flex items-center gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                if (e.key === "Escape") setNaming(false);
              }}
              // Three examples instead of a blank prompt: they say what size
              // of thing belongs here without a sentence of explanation.
              placeholder="Work, Study, Health…"
              aria-label="Name of the goal this block is part of"
              autoFocus
              className="min-w-0 flex-1 rounded-edge bg-sunk px-3 py-2 text-fine text-deep ring-1 ring-rule outline-none focus:ring-accent/40"
            />
            <button
              type="button"
              onClick={create}
              disabled={!draft.trim()}
              className="rounded-edge bg-accent px-3 py-2 text-fine text-paper disabled:bg-rule disabled:text-faint"
            >
              Add
            </button>
          </div>
        )}

        {/* Restyling a goal here changes it everywhere that goal appears — it
            belongs to the goal, not to this block. */}
        {thread && (
          <div className="mt-4 border-t border-grid pt-4">
            <GoalStyle
              thread={thread}
              onPatch={(patch) => onPatchThread(thread.id, patch)}
            />
          </div>
        )}
      </Section>

      {/* ---- moving it out of this day ---- */}
      {block.status !== "done" && (
        <button
          type="button"
          onClick={() => {
            onCarry(block);
            onClose();
          }}
          className="mt-6 flex w-full items-center gap-3 rounded-edge px-3 py-3 text-left ring-1 ring-rule transition-colors hover:bg-sunk"
        >
          <Icon name="overflow" size={16} className="shrink-0 text-faint" />
          <span className="min-w-0 flex-1">
            <span className="block text-fine text-ink">Move to tomorrow</span>
            <span className="block text-micro text-faint">
              It leaves today and appears there, whole.
            </span>
          </span>
        </button>
      )}

      {/* ---- destructive ---- */}
      <div className="mt-4 flex items-center justify-between border-t border-grid pt-4">
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
            <span className="num text-micro text-faint">{block.status}</span>
          </>
        )}
      </div>
    </Sheet>
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
