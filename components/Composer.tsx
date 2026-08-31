"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { parseQuickAdd, type ParseToken } from "@/lib/parse/quickAdd";
import { setDuration, setTime, stripThread } from "@/lib/parse/edit";
import { formatClock, formatDuration } from "@/lib/time";
import { threadColor, type Thread } from "@/lib/threads";
import { Icon } from "@/components/icons/Icon";
import { GoalIcon, isGoalIcon } from "@/components/icons/GoalIcon";
import { GoalStyle } from "@/components/GoalStyle";
import { SendButton } from "@/components/SendButton";

/* ==========================================================================
   Where everything is made — in one act.
   --------------------------------------------------------------------------
   A field, the goals laid out under it, and two chips for how long and when.
   Writing a block and saying what it is for is one continuous gesture: there
   is no goal to set up first and nothing to attach afterwards.

   That is the whole point of this file. The goals used to be in two other
   places — a scrolling row in the header that only opened settings, and a
   chip here that hid them behind a panel — so giving a block a goal read as a
   third step after inventing the goal and writing the block. Now the goals
   are simply present, all of them, and one tap is the entire assignment.

   The chips are not a second way of doing what the syntax does: they rewrite
   the same string the parser reads, so "45m" typed and 45m tapped are the
   same edit and cannot contradict each other.
   ========================================================================== */

const DURATIONS = [15, 30, 45, 60, 90, 120];

const TOKEN_TINT: Record<ParseToken["type"], string> = {
  duration: "color-mix(in oklab, var(--color-accent) 16%, transparent)",
  time: "color-mix(in oklab, var(--color-accent) 26%, transparent)",
  thread: "color-mix(in oklab, var(--color-ink) 14%, transparent)",
};

/* Shared by the input and the highlight layer beneath it. Any divergence
   here — a different size, weight, tracking or padding — makes the tint drift
   off the text it belongs to, so the two read from one constant. */
const FIELD_TYPE =
  "font-[family-name:var(--font-mono)] text-base leading-6 tracking-[-0.01em]";
const FIELD_BOX = "py-3 pl-3 pr-12";

type Panel = "duration" | "time";

export interface ComposerHandle {
  /** Drop text into the field and put the cursor after it. */
  prefill: (text: string) => void;
}

interface Props {
  threads: Thread[];
  nowMin: number;
  onSubmit: (input: string, threadId: string | null) => void;
  onCreateThread: (name: string) => Promise<Thread>;
  onPatchThread: (id: string, patch: Partial<Omit<Thread, "id">>) => void;
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  { threads, nowMin, onSubmit, onCreateThread, onPatchThread },
  ref,
) {
  const [value, setValue] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  /* A goal made a moment ago, still on screen. Its colour and icon appear by
     themselves rather than behind a tap: choosing how it looks belongs to the
     breath in which it was named, not to a trip somewhere else. */
  const [justMade, setJustMade] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Exposed imperatively rather than as a prop: tapping an open stretch fills
  // the field and focuses it, which is an event, not a piece of state. Passing
  // it down as a value would need an effect to detect the change and would
  // re-fire whenever the parent re-rendered.
  useImperativeHandle(ref, () => ({
    prefill(text: string) {
      setValue(text);
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      // After React has painted the new value, park the caret at the end.
      requestAnimationFrame(() => {
        el.setSelectionRange(text.length, text.length);
      });
    },
  }));

  const { parsed, tokens } = useMemo(() => parseQuickAdd(value), [value]);

  /* A goal reaches the block one of two ways: picked from the chip, or typed
     as a #tag. The chip wins when both are present, because tapping it strips
     the tag — otherwise the field would show one goal and the block get
     another. */
  const typedThread = useMemo(() => {
    if (!parsed.threadName) return null;
    const needle = parsed.threadName.toLowerCase();
    return (
      threads.find((t) => t.name.toLowerCase() === needle) ??
      threads.find((t) => t.name.toLowerCase().startsWith(needle)) ??
      null
    );
  }, [parsed.threadName, threads]);

  const chosenThread = threadId
    ? (threads.find((t) => t.id === threadId) ?? null)
    : null;
  const thread = chosenThread ?? typedThread;

  const hasDuration = tokens.some((t) => t.type === "duration");

  function edit(next: string) {
    setValue(next);
    inputRef.current?.focus();
  }

  /* Tapping the goal that is already chosen clears it, so the row is a
     toggle rather than a trap you can only get out of by picking another. */
  function pickThread(id: string) {
    setThreadId((current) => (current === id ? null : id));
    setJustMade(null);
    // A #tag left in the text would say one goal while the row shows another.
    setValue((v) => stripThread(v));
  }

  function createThread() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    setNaming(false);
    onCreateThread(name)
      .then((made) => {
        setThreadId(made.id);
        setJustMade(made.id);
        setValue((v) => stripThread(v));
      })
      // The failure is already on screen: useDay puts the store's error
      // where the day was.
      .catch(() => {});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed.title) return;
    onSubmit(value, threadId);
    setValue("");
    setThreadId(null);
    setPanel(null);
    setNaming(false);
    setJustMade(null);
    inputRef.current?.focus();
  }

  /* Rebuild the string as tinted and untinted runs. */
  const runs = useMemo(() => {
    const out: { text: string; type: ParseToken["type"] | null }[] = [];
    let cursor = 0;
    for (const t of tokens) {
      if (t.start > cursor) {
        out.push({ text: value.slice(cursor, t.start), type: null });
      }
      out.push({ text: value.slice(t.start, t.end), type: t.type });
      cursor = t.end;
    }
    if (cursor < value.length) {
      out.push({ text: value.slice(cursor), type: null });
    }
    return out;
  }, [value, tokens]);

  return (
    <form onSubmit={submit} className="w-full">
      {/* One panel at a time, and the open one closes before the next opens:
          overlapping them makes the footer lurch through two heights at once. */}
      <AnimatePresence initial={false} mode="wait">
        {panel && (
          <motion.div
            key={panel}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="overflow-hidden"
          >
            <div className="max-h-[42dvh] overflow-y-auto pb-3">
              {panel === "duration" && (
                <div className="flex flex-wrap gap-1.5">
                  {DURATIONS.map((min) => (
                    <Chip
                      key={min}
                      active={hasDuration && parsed.plannedMin === min}
                      onClick={() => {
                        edit(setDuration(value, min));
                        setPanel(null);
                      }}
                    >
                      {formatDuration(min)}
                    </Chip>
                  ))}
                </div>
              )}

              {panel === "time" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip
                    active={parsed.startMin === null}
                    onClick={() => {
                      edit(setTime(value, null));
                      setPanel(null);
                    }}
                  >
                    <Icon name="flow" size={13} />
                    Anytime
                  </Chip>
                  <Chip
                    active={false}
                    onClick={() => {
                      // Rounded up to the next quarter: "now" as a start time
                      // means the next moment you could actually begin. Held
                      // below midnight, which would otherwise wrap to 00:00
                      // and read as the start of the day just finished.
                      const next = Math.min(23 * 60 + 45, Math.ceil(nowMin / 15) * 15);
                      edit(setTime(value, next));
                      setPanel(null);
                    }}
                  >
                    Now
                  </Chip>
                  <input
                    type="time"
                    value={formatClock(parsed.startMin ?? 9 * 60)}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      if (Number.isFinite(h) && Number.isFinite(m)) {
                        setValue(setTime(value, h * 60 + m));
                      }
                    }}
                    aria-label="Start time"
                    className="num rounded-edge bg-sunk px-2.5 py-2 text-fine text-deep ring-1 ring-rule outline-none focus:ring-accent/40"
                  />
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative rounded-edge bg-sunk ring-1 ring-rule transition-shadow focus-within:shadow-lift focus-within:ring-accent/40">
        {/* The visible text, tinted where the parser recognised something.
            The input above is transparent apart from its caret, so there is
            exactly one set of glyphs on screen. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-deep ${FIELD_TYPE} ${FIELD_BOX}`}
        >
          {runs.map((r, i) => (
            <span
              key={i}
              style={
                r.type
                  ? {
                      background: TOKEN_TINT[r.type],
                      borderRadius: "var(--radius-hair)",
                    }
                  : undefined
              }
            >
              {r.text}
            </span>
          ))}
        </div>

        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          // Reads as a sentence and happens to be the syntax: the chips below
          // do the same job, so nobody has to learn it, but it stays visible
          // for anyone who would rather type than tap.
          placeholder="Lake walk 45m at 18:00"
          autoCapitalize="sentences"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="Add a block"
          className={`relative w-full bg-transparent outline-none placeholder:text-faint/50 ${FIELD_TYPE} ${FIELD_BOX}`}
          style={{ color: "transparent", caretColor: "var(--color-accent)" }}
        />

        <SendButton disabled={!parsed.title} label="Add this block" />
      </div>

      {/* Every goal, laid out. It wraps rather than scrolling sideways: a row
          you have to drag to read is a row whose far end nobody ever sees. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {threads.map((t) => {
          const colour = threadColor(t.colorIndex);
          const on = thread?.id === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => pickThread(t.id)}
              className="flex items-center gap-1.5 rounded-edge px-2.5 py-1.5 text-fine transition-colors"
              style={{
                // Chosen: wearing its own colour, mixed with paper so the name
                // stays readable across all sixteen and both themes.
                background: on
                  ? `color-mix(in oklab, ${colour} 24%, var(--color-paper))`
                  : "transparent",
                boxShadow: on
                  ? `inset 0 0 0 1.5px ${colour}`
                  : "inset 0 0 0 1px var(--color-rule)",
                color: on ? "var(--color-deep)" : "var(--color-ink)",
              }}
            >
              {isGoalIcon(t.icon) ? (
                <GoalIcon name={t.icon} size={13} style={{ color: colour }} />
              ) : (
                <span
                  className="inline-block h-2 w-2 rounded-plate"
                  style={{ background: colour }}
                />
              )}
              {t.name}
            </button>
          );
        })}

        {!naming && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="flex items-center gap-1.5 rounded-edge px-2.5 py-1.5 text-fine text-faint ring-1 ring-rule transition-colors hover:bg-sunk hover:text-ink"
          >
            <Icon name="plus" size={13} />
            {threads.length === 0 ? "Goal" : ""}
          </button>
        )}

        {/* A goal typed as a #tag that names nothing yet. It becomes real on
            send; showing it here keeps the row honest in the meantime. */}
        {!thread && parsed.threadName && (
          <span className="rounded-edge px-2.5 py-1.5 text-fine text-faint ring-1 ring-rule ring-dashed">
            {parsed.threadName} · new
          </span>
        )}
      </div>

      {naming && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // This lives inside the composer's form; without stopping the
              // key, Enter would submit the block instead of naming the goal.
              if (e.key === "Enter") {
                e.preventDefault();
                createThread();
              }
              if (e.key === "Escape") setNaming(false);
            }}
            placeholder="Name the goal…"
            aria-label="New goal name"
            autoFocus
            className="min-w-0 flex-1 rounded-edge bg-sunk px-3 py-2 text-fine text-deep ring-1 ring-rule outline-none focus:ring-accent/40"
          />
          <button
            type="button"
            onClick={createThread}
            disabled={!draft.trim()}
            className="rounded-edge bg-accent px-3 py-2 text-fine text-paper disabled:bg-rule disabled:text-faint"
          >
            Create
          </button>
        </div>
      )}

      {/* The colour and icon of a goal named a moment ago, offered without
          being asked for — and gone again once the block is sent. */}
      {justMade && thread?.id === justMade && (
        <div className="mt-3 border-t border-grid pt-3">
          <GoalStyle
            thread={thread}
            onPatch={(patch) => onPatchThread(thread.id, patch)}
          />
        </div>
      )}

      {/* How long, and when. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <ChipToggle
          open={panel === "duration"}
          onClick={() => setPanel(panel === "duration" ? null : "duration")}
          muted={!hasDuration}
        >
          <Icon name="duration" size={13} />
          {formatDuration(parsed.plannedMin)}
        </ChipToggle>

        <ChipToggle
          open={panel === "time"}
          onClick={() => setPanel(panel === "time" ? null : "time")}
          muted={parsed.startMin === null}
        >
          <Icon name={parsed.startMin === null ? "flow" : "anchor"} size={13} />
          {/* The answer to "when", not the name of a mechanism. Nobody should
              have to be told what "anchored" means to plan an afternoon. */}
          {parsed.startMin === null
            ? "Anytime"
            : `At ${formatClock(parsed.startMin)}`}
        </ChipToggle>
      </div>
    </form>
  );
});

/* -------------------------------------------------------------------------- */


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

function ChipToggle({
  open,
  muted,
  onClick,
  children,
}: {
  open: boolean;
  /** Nothing was said about this yet, so it is showing a default. */
  muted: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={`flex max-w-full items-center gap-1.5 truncate rounded-edge px-2.5 py-1.5 text-fine transition-colors ${
        open
          ? "bg-accent-soft text-accent ring-1 ring-accent/40"
          : muted
            ? "text-faint ring-1 ring-rule"
            : "text-ink ring-1 ring-rule"
      }`}
    >
      {children}
    </button>
  );
}
