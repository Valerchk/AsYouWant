"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Icon, type IconName } from "@/components/icons/Icon";
import { SendButton } from "@/components/SendButton";
import { LoadFailure } from "@/components/LoadFailure";
import { ListSkeleton } from "@/components/Skeleton";
import { Notice } from "@/components/Notice";
import { useMeasuredHeight } from "@/lib/useMeasuredHeight";
import { parseQuickAdd, DEFAULT_DURATION_MIN } from "@/lib/parse/quickAdd";
import { formatClock, formatDuration, localDay } from "@/lib/time";
import { relativeTime } from "@/lib/store/notes";
import { useNowMin, CLOCK_NOT_READY } from "@/lib/useNow";
import { useNotes } from "@/lib/data/useNotes";
import { useDay } from "@/lib/data/useDay";
import type { NoteData } from "@/lib/data/types";

/* Two lists, one screen.

   **Today** holds intentions: things you mean to do today that take no place
   on the clock. A day can be full of blocks and still miss the point, so the
   thing you actually want is allowed to exist without a time.

   **Someday** is everything you have not chosen a day for yet.

   An intention can be ticked off where it stands. Before that it could only
   be given an hour or deleted, so anything that simply got done had to be
   thrown away as though it had not happened — which is not a list, it is a
   holding pen. Ticked ones stay, greyed and at the bottom, because the point
   of a day's intentions is being able to look back at them in the evening. */

export default function Inbox() {
  const nowMin = useNowMin();
  if (nowMin === CLOCK_NOT_READY) return <ListSkeleton title={96} rows={5} />;
  return <InboxScreen nowMin={nowMin} />;
}

/** Open first, then the finished ones, each group newest first. */
function ordered(notes: NoteData[]): NoteData[] {
  return [...notes].sort((a, b) => {
    if (!a.doneAt !== !b.doneAt) return a.doneAt ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

function InboxScreen({ nowMin }: { nowMin: number }) {
  const router = useRouter();
  const today = localDay();
  const {
    notes,
    loading,
    error,
    problem,
    clearProblem,
    add,
    remove,
    setPlannedFor,
    setText,
    setDone,
  } = useNotes();
  const { addBlockWithThread } = useDay(today, nowMin);

  const [draft, setDraft] = useState("");
  const [footerRef, footerH] = useMeasuredHeight<HTMLElement>();
  // Which list the new note joins. Defaults to today, because that is what
  // people reach for the app to capture.
  const [asIntention, setAsIntention] = useState(true);
  const [promoted, setPromoted] = useState<string | null>(null);

  const { intentions, someday, doneToday } = useMemo(() => {
    const mine = notes.filter((n) => n.plannedFor === today);
    return {
      intentions: ordered(mine),
      someday: ordered(notes.filter((n) => n.plannedFor !== today)),
      doneToday: mine.filter((n) => n.doneAt !== null).length,
    };
  }, [notes, today]);

  /* The field grows with what is in it, up to a limit, then scrolls. */
  const grow = useRef<HTMLTextAreaElement>(null);
  function fit(e: React.FormEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function capture(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    add(text, asIntention ? today : null);
    setDraft("");
    const el = grow.current;
    if (el) el.style.height = "auto";
  }

  /* Give an intention a place on the clock. The text runs through the same
     parser as the day's input, so "gym 45m 7pm" arrives as a real block. */
  function schedule(note: NoteData) {
    const { parsed } = parseQuickAdd(note.text);
    const block = {
      title: parsed.title || note.text,
      kind: parsed.kind,
      startMin: parsed.startMin,
      plannedMin: parsed.plannedMin,
      status: "planned" as const,
      threadId: null,
      actualStartMin: null,
      actualEndMin: null,
    };
    /* The parser reads a #tag out of the note and this used to throw it away,
       so "gym #health" arrived on the day belonging to nothing — the one
       piece of intent the thought actually carried, dropped in transit. */
    addBlockWithThread(block, parsed.threadName);
    setPromoted(note.id);
    remove(note.id);
    setTimeout(() => router.push("/today"), 260);
  }

  if (error) return <LoadFailure what="your inbox" message={error} />;
  // One state for the whole screen rather than the word LOADING under a
  // heading while the section above it already claimed to be empty.
  if (loading) return <ListSkeleton title={96} rows={5} />;

  const rowProps = (note: NoteData) => ({
    note,
    promoted: promoted === note.id,
    onSchedule: () => schedule(note),
    onDelete: () => remove(note.id),
    onEdit: (text: string) => setText(note.id, text),
    onToggle: () => setDone(note.id, note.doneAt === null),
  });

  return (
    <>
      <main
        className="chrome mx-auto max-w-2xl"
        // Falls back until the footer has been measured, so the first
        // paint is not a page with no room at the bottom.
        style={{ paddingBottom: (footerH || 128) + 24 }}
      >
        <header className="safe-top px-6 pt-7">
          <div className="num text-micro tracking-[0.18em] text-faint">
            THINGS WITHOUT A TIME
          </div>
          <div className="mt-1.5 flex items-baseline gap-3">
            <h1 className="display text-title text-deep">Inbox</h1>
            {intentions.length > 0 && (
              <span className="num text-micro text-faint">
                {doneToday} of {intentions.length} today
              </span>
            )}
          </div>
          {/* One bar for the day's intentions. The count alone is a number;
              the bar is the thing you can read without doing arithmetic. */}
          {intentions.length > 0 && (
            <div className="mt-3 h-1 overflow-hidden rounded-plate bg-sunk">
              <motion.div
                className="h-full bg-accent"
                initial={false}
                animate={{ width: `${(doneToday / intentions.length) * 100}%` }}
                transition={{ type: "spring", stiffness: 260, damping: 34 }}
              />
            </div>
          )}
        </header>

        <div className="mt-8 space-y-9 px-6">
          <Section
            label="Today"
            hint="What you mean to do, with no hour attached."
            count={intentions.length}
          >
            {intentions.length === 0 ? (
              <Empty>
                Nothing set for today. Write one below — it takes no place on
                the clock until you give it one.
              </Empty>
            ) : (
              <ul className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {intentions.map((note) => (
                    <NoteRow
                      key={note.id}
                      {...rowProps(note)}
                      onMove={() => setPlannedFor(note.id, null)}
                      moveLabel="Someday"
                      moveIcon="moon"
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </Section>

          <Section
            label="Someday"
            hint="Caught, but not for today."
            count={someday.length}
          >
            {someday.length === 0 ? (
              <Empty>
                Anything you catch without choosing a day lands here, and waits
                without asking anything of you.
              </Empty>
            ) : (
              <ul className="space-y-2.5">
                <AnimatePresence initial={false}>
                  {someday.map((note) => (
                    <NoteRow
                      key={note.id}
                      {...rowProps(note)}
                      onMove={() => setPlannedFor(note.id, today)}
                      moveLabel="Today"
                      moveIcon="sunrise"
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </Section>
        </div>
      </main>

      <footer
        ref={footerRef}
        className="above-tabs border-t border-rule bg-paper"
      >
        <div className="mx-auto max-w-2xl px-6 pt-3.5">
          <Notice message={problem} onDismiss={clearProblem} />
        </div>
        <form onSubmit={capture} className="mx-auto max-w-2xl px-6 pb-3.5">
          {/* A textarea, not a single line. A thought caught in a hurry is
              rarely one clause, and a field that scrolls sideways past the
              first ten words is a field people stop using. Return makes a new
              line here; the button is what sends. */}
          <div className="relative">
            <textarea
              ref={grow}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onInput={fit}
              rows={1}
              placeholder={asIntention ? "Today I want to…" : "Catch a thought…"}
              aria-label="Add"
              className="block max-h-40 w-full resize-none overflow-y-auto rounded-edge bg-sunk py-3 pr-12 pl-3 text-base leading-6 text-deep ring-1 ring-rule outline-none transition-shadow placeholder:text-faint/60 focus:shadow-lift focus:ring-accent/40"
            />
            <SendButton
              disabled={!draft.trim()}
              label={asIntention ? "Add to today" : "Add to someday"}
            />
          </div>
          <div className="mt-2 flex gap-1.5">
            <Toggle active={asIntention} onClick={() => setAsIntention(true)}>
              Today
            </Toggle>
            <Toggle active={!asIntention} onClick={() => setAsIntention(false)}>
              Someday
            </Toggle>
          </div>
        </form>
      </footer>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-plate border border-dashed border-grid px-3.5 py-4 text-fine leading-6 text-faint">
      {children}
    </p>
  );
}

/* The heading is deliberately the quietest thing in its own section. It used
   to carry a hint under it at all times, in the same size and colour as the
   note beneath — so the label, the explanation and the thought itself were
   three greys of equal weight and the only one that mattered came third. The
   hint now appears only where there is nothing to explain it away. */
function Section({
  label,
  hint,
  count,
  children,
}: {
  label: string;
  hint: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2.5">
        <h2 className="text-micro tracking-[0.18em] text-faint uppercase">
          {label}
        </h2>
        <span className="num text-micro text-faint/70">{count}</span>
        {count === 0 && (
          <span className="min-w-0 flex-1 truncate text-micro text-faint/70">
            {hint}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function Toggle({
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
      className={`rounded-edge px-2.5 py-1 text-micro transition-colors ${
        active
          ? "bg-accent-soft text-accent ring-1 ring-accent/40"
          : "text-faint ring-1 ring-rule"
      }`}
    >
      {children}
    </button>
  );
}

/* ==========================================================================
   One caught thought.
   --------------------------------------------------------------------------
   A card, and the thought is the only thing in its top line.

   It used to be a row: a marker, then the text, then three controls, all on
   one line — which left the words about a hundred and fifty pixels on a phone.
   "Приготовить вафельный торт" wrapped to two cramped lines and then sat at
   the same size and weight as the section heading above it, the hint under
   that, the timestamp below and the buttons beside. Six greys, and the one
   piece of content among them was indistinguishable from its own furniture.

   So the words get the full width and the largest type on the screen, and
   everything that acts on them moves to a quiet line underneath — named,
   because a clock glyph does not say "give this an hour" to anyone who has
   not already been told.
   ========================================================================== */

function NoteRow({
  note,
  promoted,
  onSchedule,
  onMove,
  moveLabel,
  moveIcon,
  onDelete,
  onEdit,
  onToggle,
}: {
  note: NoteData;
  promoted: boolean;
  onSchedule: () => void;
  onMove: () => void;
  moveLabel: string;
  moveIcon: IconName;
  onDelete: () => void;
  onEdit: (text: string) => void;
  onToggle: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { parsed } = parseQuickAdd(note.text);
  const hasDetail =
    parsed.startMin !== null || parsed.plannedMin !== DEFAULT_DURATION_MIN;
  const done = note.doneAt !== null;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        x: promoted ? 60 : -20,
        transition: { duration: 0.22 },
      }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    >
      <div
        className={`rounded-plate px-3.5 py-3 ring-1 transition-colors ${
          done ? "ring-grid" : "bg-sunk ring-grid"
        }`}
      >
        <div className="flex items-start gap-3">
          {/* The same marker the ribbon uses, so a thing you mean to do looks
              the same whether or not it has an hour. */}
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={done}
            aria-label={done ? `Reopen ${note.text}` : `Finish ${note.text}`}
            className="-m-1.5 flex shrink-0 items-center justify-center p-1.5"
          >
            <motion.span
              className="flex h-[18px] w-[18px] items-center justify-center rounded-plate"
              animate={{ scale: done ? 1 : 0.92 }}
              whileTap={{ scale: 0.82 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              style={{
                background: done ? "var(--color-accent)" : "var(--color-paper)",
                boxShadow: `inset 0 0 0 1.5px ${
                  done ? "var(--color-accent)" : "var(--color-rule)"
                }`,
              }}
            >
              {done && <Icon name="check" size={11} className="text-paper" />}
            </motion.span>
          </button>

          {/* Tap the words to change them. A thought you cannot correct is a
              thought you delete and retype. The textarea is the same type and
              leading as the paragraph, so nothing jumps on the way in. */}
          {editing ? (
            <textarea
              defaultValue={note.text}
              autoFocus
              rows={Math.max(1, note.text.split("\n").length)}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next && next !== note.text) onEdit(next);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
              }}
              aria-label="Edit this note"
              className="-my-0.5 block min-w-0 flex-1 resize-none rounded-edge bg-paper px-2 py-0.5 text-lede leading-6 text-deep ring-1 ring-accent/40 outline-none"
            />
          ) : (
            <p
              onClick={() => setEditing(true)}
              className={`min-w-0 flex-1 cursor-text text-lede leading-6 whitespace-pre-wrap ${
                done
                  ? "text-faint line-through decoration-faint/60"
                  : "text-deep"
              }`}
            >
              {note.text}
            </p>
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-2.5 border-t border-grid pt-2.5">
          <span className="num shrink-0 text-micro text-faint">
            {relativeTime(note.createdAt)}
          </span>
          {hasDetail && !done && (
            <span className="num shrink-0 text-micro text-accent">
              {parsed.startMin !== null && `${formatClock(parsed.startMin)} · `}
              {formatDuration(parsed.plannedMin)}
            </span>
          )}

          {/* A finished thought needs no verbs but "undo" and "remove". */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {!done && (
              <>
                <Act icon="clock" onClick={onSchedule} accent>
                  Plan
                </Act>
                <Act icon={moveIcon} onClick={onMove}>
                  {moveLabel}
                </Act>
              </>
            )}
            <Act
              icon="close"
              onClick={onDelete}
              label={`Delete "${note.text}"`}
              danger
            />
          </div>
        </div>
      </div>
    </motion.li>
  );
}

/** One verb under a note, named rather than left as a glyph to decode. */
function Act({
  icon,
  onClick,
  children,
  label,
  accent = false,
  danger = false,
}: {
  icon: IconName;
  onClick: () => void;
  children?: React.ReactNode;
  label?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? undefined}
      title={label ?? undefined}
      className={`flex h-7 items-center gap-1 rounded-edge px-2 text-micro transition-colors ${
        accent
          ? "text-accent ring-1 ring-accent/30 hover:bg-accent-soft"
          : danger
            ? "text-faint hover:text-over"
            : "text-faint ring-1 ring-rule hover:bg-sunk hover:text-ink"
      }`}
    >
      <Icon name={icon} size={13} className="shrink-0" />
      {children}
    </button>
  );
}
