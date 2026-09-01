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

type Panel = "duration" | "time" | "look";

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
  const [draft, setDraft] = useState("");
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

  /* An empty composer is one line and nothing else. The chips describe a
     block, and until there is something written there is no block for them to
     describe — three rows of controls over an empty field is furniture. */
  const composing = value.trim().length > 0;

  function edit(next: string) {
    setValue(next);
    inputRef.current?.focus();
  }

  /* Tapping the goal that is already chosen clears it, so the row is a
     toggle rather than a trap you can only get out of by picking another. */
  function pickThread(id: string) {
    setThreadId((current) => (current === id ? null : id));
    // A #tag left in the text would say one goal while the row shows another.
    setValue((v) => stripThread(v));
  }

  /* Naming a goal and dressing it happen inside the panel that is already
     open, so a block being written never has to be abandoned to go and set
     something up first. Two screens for one thought was the complaint. */
  function createThread() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    onCreateThread(name)
      .then((made) => {
        setThreadId(made.id);
        setValue((v) => stripThread(v));
      })
      .catch(() => {
        // Already on screen: useDay puts the store's error where the day was.
      });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parsed.title) return;
    onSubmit(value, threadId);
    setValue("");
    setThreadId(null);
    setPanel(null);
    setDraft("");
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
            {/* A ceiling, not a size. The footer is fixed over the day, and
                the last thing to grow inside it hid the entire ribbon. */}
            <div className="max-h-[38dvh] overflow-y-auto pb-3">
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

              {panel === "look" && (
                <div>
                  <div className="flex flex-wrap gap-1.5">
                    {threads.map((t) => (
                      <Chip
                        key={t.id}
                        active={thread?.id === t.id}
                        onClick={() => pickThread(t.id)}
                      >
                        {isGoalIcon(t.icon) ? (
                          <GoalIcon
                            name={t.icon}
                            size={13}
                            style={{ color: threadColor(t.colorIndex) }}
                          />
                        ) : (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-plate"
                            style={{ background: threadColor(t.colorIndex) }}
                          />
                        )}
                        {t.name}
                      </Chip>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center gap-1.5">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        // Inside the composer's form: without this, Return
                        // would send the block instead of naming the goal.
                        if (e.key === "Enter") {
                          e.preventDefault();
                          createThread();
                        }
                      }}
                      // Three examples rather than a blank prompt: they say
                      // what size of thing belongs here without a sentence.
                      placeholder="Work, Study, Health…"
                      aria-label="Name a new goal"
                      className="min-w-0 flex-1 rounded-edge bg-sunk px-3 py-2 text-fine text-deep ring-1 ring-rule outline-none focus:ring-accent/40"
                    />
                    <button
                      type="button"
                      onClick={createThread}
                      disabled={!draft.trim()}
                      className="rounded-edge bg-accent px-3 py-2 text-fine text-paper disabled:bg-rule disabled:text-faint"
                    >
                      Add
                    </button>
                  </div>

                  {/* Colour and icon, in the same panel, for whichever goal is
                      selected — including one named a second ago. This is the
                      whole of "pick it and its colour at once". */}
                  {thread && (
                    <div className="mt-4 border-t border-grid pt-4">
                      <GoalStyle
                        thread={thread}
                        onPatch={(patch) => onPatchThread(thread.id, patch)}
                      />
                    </div>
                  )}
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

      {/* Every goal that exists, laid out — one tap attaches it. It wraps
          rather than scrolling sideways: a row you have to drag to read is a
          row whose far end nobody ever sees.

          There is no way to make a goal from here, and that is the point. An
          empty "＋" beside a list of coloured labels is an invitation to type
          the thing you want to do, and a day planner that answers "Change my
          address" with a colour swatch has misled you. A goal is only ever
          born from a block that already exists — see BlockSheet. */}
      {/* How long, when, and what it is part of.

          Animated rather than switched on: the footer is pinned over the day,
          so a row appearing at full height moves everything above it in one
          frame, which reads as the page glitching. */}
      <AnimatePresence initial={false}>
      {composing && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
        className="overflow-hidden"
      >
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

        <ChipToggle
          open={panel === "look"}
          onClick={() => setPanel(panel === "look" ? null : "look")}
          muted={!thread && !parsed.threadName}
        >
          {thread ? (
            isGoalIcon(thread.icon) ? (
              <GoalIcon
                name={thread.icon}
                size={13}
                style={{ color: threadColor(thread.colorIndex) }}
              />
            ) : (
              <span
                className="inline-block h-2.5 w-2.5 rounded-plate"
                style={{ background: threadColor(thread.colorIndex) }}
              />
            )
          ) : (
            <Icon name="thread" size={13} />
          )}
          {thread
            ? thread.name
            : parsed.threadName
              ? `${parsed.threadName} · new`
              : "Goal"}
        </ChipToggle>
      </div>
      </motion.div>
      )}
      </AnimatePresence>
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
