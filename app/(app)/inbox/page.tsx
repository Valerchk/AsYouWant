"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "@/components/icons/Icon";
import { LoadFailure } from "@/components/LoadFailure";
import { parseQuickAdd, DEFAULT_DURATION_MIN } from "@/lib/parse/quickAdd";
import { formatClock, formatDuration } from "@/lib/time";
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

   Neither touches the ribbon until you say so. */

function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default function Inbox() {
  const nowMin = useNowMin();
  if (nowMin === CLOCK_NOT_READY) return <main className="min-h-dvh bg-paper" />;
  return <InboxScreen nowMin={nowMin} />;
}

function InboxScreen({ nowMin }: { nowMin: number }) {
  const router = useRouter();
  const { notes, loading, error, add, remove, setPlannedFor } = useNotes();
  const { addBlock } = useDay(nowMin);

  const [draft, setDraft] = useState("");
  // Which list the new note joins. Defaults to today, because that is what
  // people reach for the app to capture.
  const [asIntention, setAsIntention] = useState(true);
  const [promoted, setPromoted] = useState<string | null>(null);

  const today = localDay();
  const { intentions, someday } = useMemo(
    () => ({
      intentions: notes.filter((n) => n.plannedFor === today),
      someday: notes.filter((n) => n.plannedFor !== today),
    }),
    [notes, today],
  );

  function capture(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    add(text, asIntention ? today : null);
    setDraft("");
  }

  /* Give an intention a place on the clock. The text runs through the same
     parser as the day's input, so "gym 45m 7pm" arrives as a real block. */
  function schedule(note: NoteData) {
    const { parsed } = parseQuickAdd(note.text);
    addBlock({
      title: parsed.title || note.text,
      kind: parsed.kind,
      startMin: parsed.startMin,
      plannedMin: parsed.plannedMin,
      status: "planned",
      threadId: null,
      actualStartMin: null,
      actualEndMin: null,
    });
    setPromoted(note.id);
    remove(note.id);
    setTimeout(() => router.push("/today"), 260);
  }

  if (error) return <LoadFailure what="your inbox" message={error} />;

  return (
    <>
      <main className="chrome mx-auto max-w-2xl pb-32">
        <header className="safe-top px-6 pt-7">
          <div className="num text-micro tracking-[0.18em] text-faint">
            THINGS WITHOUT A TIME
          </div>
          <h1 className="display mt-1.5 text-title text-deep">Inbox</h1>
        </header>

        <div className="mt-7 px-6">
          <Section
            label="Today"
            hint="What you mean to do, with no hour attached."
            count={intentions.length}
          />
          {intentions.length === 0 ? (
            <p className="pb-2 text-fine text-faint">
              Nothing set for today yet.
            </p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {intentions.map((note) => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    promoted={promoted === note.id}
                    onSchedule={() => schedule(note)}
                    onMove={() => setPlannedFor(note.id, null)}
                    moveLabel="Someday"
                    onDelete={() => remove(note.id)}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}

          <div className="mt-9">
            <Section
              label="Someday"
              hint="Caught, but not for today."
              count={someday.length}
            />
            {loading ? (
              <div className="num text-micro text-faint">LOADING</div>
            ) : someday.length === 0 ? (
              <p className="text-fine text-faint">
                Anything you catch without choosing a day lands here.
              </p>
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {someday.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      promoted={promoted === note.id}
                      onSchedule={() => schedule(note)}
                      onMove={() => setPlannedFor(note.id, today)}
                      moveLabel="Today"
                      onDelete={() => remove(note.id)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </div>
      </main>

      <div className="above-tabs border-t border-rule bg-paper/92 backdrop-blur-sm">
        <form onSubmit={capture} className="mx-auto max-w-2xl px-6 py-3.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={asIntention ? "Today I want to…" : "Catch a thought…"}
            enterKeyHint="done"
            aria-label="Add"
            className="w-full rounded-edge bg-sunk px-3 py-3 text-base text-deep ring-1 ring-rule outline-none transition-shadow placeholder:text-faint/60 focus:shadow-lift focus:ring-accent/40"
          />
          <div className="mt-2 flex gap-1.5">
            <Toggle active={asIntention} onClick={() => setAsIntention(true)}>
              Today
            </Toggle>
            <Toggle active={!asIntention} onClick={() => setAsIntention(false)}>
              Someday
            </Toggle>
          </div>
        </form>
      </div>
    </>
  );
}

function Section({
  label,
  hint,
  count,
}: {
  label: string;
  hint: string;
  count: number;
}) {
  return (
    <div className="mb-3 border-b border-rule pb-2">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-micro tracking-[0.18em] text-faint uppercase">
          {label}
        </h2>
        <span className="num text-micro text-faint">{count}</span>
      </div>
      <p className="mt-1 text-micro text-faint">{hint}</p>
    </div>
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

function NoteRow({
  note,
  promoted,
  onSchedule,
  onMove,
  moveLabel,
  onDelete,
}: {
  note: NoteData;
  promoted: boolean;
  onSchedule: () => void;
  onMove: () => void;
  moveLabel: string;
  onDelete: () => void;
}) {
  const { parsed } = parseQuickAdd(note.text);
  const hasDetail =
    parsed.startMin !== null || parsed.plannedMin !== DEFAULT_DURATION_MIN;

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
      className="flex items-start gap-2 border-b border-grid py-3.5"
    >
      <div className="min-w-0 flex-1">
        <p className="text-base leading-6 text-ink">{note.text}</p>
        <div className="mt-1 flex items-center gap-2.5 text-micro text-faint">
          <span className="num">{relativeTime(note.createdAt)}</span>
          {hasDetail && (
            <span className="num text-accent">
              {parsed.startMin !== null && `${formatClock(parsed.startMin)} · `}
              {formatDuration(parsed.plannedMin)}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onMove}
        className="h-9 shrink-0 rounded-edge px-2 text-micro text-faint transition-colors hover:bg-sunk hover:text-ink"
      >
        {moveLabel}
      </button>

      <button
        type="button"
        onClick={onSchedule}
        aria-label={`Give "${note.text}" a time`}
        title="Give it a time"
        className="flex h-9 shrink-0 items-center gap-1 rounded-edge px-2 text-micro text-accent ring-1 ring-accent/30 transition-colors hover:bg-accent-soft"
      >
        <Icon name="clock" size={13} />
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete "${note.text}"`}
        className="flex h-9 w-7 shrink-0 items-center justify-center text-faint transition-colors hover:text-over"
      >
        <Icon name="close" size={15} />
      </button>
    </motion.li>
  );
}
