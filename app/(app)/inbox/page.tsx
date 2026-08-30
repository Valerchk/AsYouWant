"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "@/components/icons/Icon";
import { LoadFailure } from "@/components/LoadFailure";
import { parseQuickAdd } from "@/lib/parse/quickAdd";
import { formatClock, formatDuration } from "@/lib/time";
import { relativeTime } from "@/lib/store/notes";
import { useNowMin, CLOCK_NOT_READY } from "@/lib/useNow";
import { useNotes } from "@/lib/data/useNotes";
import { useDay } from "@/lib/data/useDay";
import { DEFAULT_DURATION_MIN } from "@/lib/parse/quickAdd";

/* Somewhere to put a thought without deciding when to do it.

   The whole point is that nothing here is on a timeline: a note has no time,
   no duration and no place in the day until you decide it has one. */

export default function Inbox() {
  const nowMin = useNowMin();
  if (nowMin === CLOCK_NOT_READY) return <main className="min-h-dvh bg-paper" />;
  return <InboxScreen nowMin={nowMin} />;
}

function InboxScreen({ nowMin }: { nowMin: number }) {
  const router = useRouter();
  const { notes, loading, error, add, remove } = useNotes();
  // Shares the day store with the Today screen, so a promoted note lands in
  // the same place the ribbon reads from.
  const { addBlock } = useDay(nowMin);

  const [draft, setDraft] = useState("");
  const [promoted, setPromoted] = useState<string | null>(null);

  function capture(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    add(text);
    setDraft("");
  }

  /* Promote a note into today. The text runs through the same parser as the
     day's input, so "gym 45m 7pm" arrives as a real block rather than a title
     with a default length. */
  function promote(note: { id: string; text: string }) {
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
    // Let the row finish leaving before the screen changes under it.
    setTimeout(() => router.push("/today"), 260);
  }

  if (error) return <LoadFailure what="your inbox" message={error} />;

  return (
    <>
      <main className="chrome mx-auto max-w-2xl pb-32">
        <header className="safe-top px-6 pt-7">
          <div className="num text-micro tracking-[0.18em] text-faint">
            NO TIME ATTACHED
          </div>
          <h1 className="display mt-1.5 text-title text-deep">Inbox</h1>
          <div className="mt-6 border-t border-rule pt-4">
            <span className="num text-fine text-ink">
              {loading ? "—" : notes.length}
            </span>
            <span className="ml-2 text-micro text-faint">
              {notes.length === 1 ? "note" : "notes"} waiting
            </span>
          </div>
        </header>

        <div className="mt-6 px-6">
          {!loading && notes.length === 0 ? (
            <p className="text-fine text-faint">
              Catch a thought here and decide later. Nothing in the inbox is on
              your day until you put it there.
            </p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {notes.map((note) => {
                  const { parsed } = parseQuickAdd(note.text);
                  const hasDetail =
                    parsed.startMin !== null ||
                    parsed.plannedMin !== DEFAULT_DURATION_MIN;

                  return (
                    <motion.li
                      key={note.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{
                        opacity: 0,
                        // Promoted notes fly toward the day; deleted ones just go.
                        x: promoted === note.id ? 60 : -20,
                        transition: { duration: 0.22 },
                      }}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="flex items-start gap-3 border-b border-grid py-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-base leading-6 text-ink">
                          {note.text}
                        </p>
                        <div className="mt-1 flex items-center gap-2.5 text-micro text-faint">
                          <span className="num">
                            {relativeTime(note.createdAt)}
                          </span>
                          {hasDetail && (
                            <span className="num text-accent">
                              {parsed.startMin !== null &&
                                `${formatClock(parsed.startMin)} · `}
                              {formatDuration(parsed.plannedMin)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => promote(note)}
                        aria-label={`Put "${note.text}" on today`}
                        className="flex h-10 shrink-0 items-center gap-1.5 rounded-edge px-2.5 text-micro text-accent ring-1 ring-accent/30 transition-colors hover:bg-accent-soft"
                      >
                        Today
                        <Icon name="chevron" size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => remove(note.id)}
                        aria-label={`Delete "${note.text}"`}
                        className="flex h-10 w-8 shrink-0 items-center justify-center text-faint transition-colors hover:text-over"
                      >
                        <Icon name="close" size={15} />
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </main>

      {/* Same position as the day's input, so the thumb learns one place. */}
      <div className="above-tabs border-t border-rule bg-paper/92 backdrop-blur-sm">
        <form onSubmit={capture} className="mx-auto max-w-2xl px-6 py-3.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Catch a thought…"
            enterKeyHint="done"
            aria-label="Add a note"
            className="w-full rounded-edge bg-sunk px-3 py-3 text-base text-deep ring-1 ring-rule outline-none transition-shadow placeholder:text-faint/60 focus:ring-accent/40 focus:shadow-lift"
          />
        </form>
      </div>
    </>
  );
}
