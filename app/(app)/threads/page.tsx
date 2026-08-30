"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "@/components/icons/Icon";
import { LoadFailure } from "@/components/LoadFailure";
import { formatDuration } from "@/lib/time";
import { threadColor, THREAD_COLOR_COUNT, type Thread } from "@/lib/threads";
import { useNowMin, CLOCK_NOT_READY } from "@/lib/useNow";
import { useDay } from "@/lib/data/useDay";
import { dayStore } from "@/lib/data";

/* Goals, and how much of the week each one actually got.

   Until this screen existed a goal could only be born by typing a #tag, which
   on an empty account meant guessing a syntax nobody had shown you. */

const TARGETS = [0, 60, 120, 300, 600, 900];

export default function Threads() {
  const nowMin = useNowMin();
  if (nowMin === CLOCK_NOT_READY) return <main className="min-h-dvh bg-paper" />;
  return <ThreadsScreen nowMin={nowMin} />;
}

function ThreadsScreen({ nowMin }: { nowMin: number }) {
  const { day, loading, error, patchThread, addThreadNamed, archiveThread } =
    useDay(nowMin);

  const [week, setWeek] = useState<Map<string, number>>(new Map());
  const [draft, setDraft] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const reloadWeek = useCallback(() => {
    dayStore()
      .loadWeek()
      .then(setWeek)
      .catch(() => {
        // A missing week only costs the progress bars; the screen still works.
      });
  }, []);

  useEffect(reloadWeek, [reloadWeek]);

  if (error) return <LoadFailure what="your goals" message={error} />;

  const threads = day?.threads ?? [];

  function create(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    addThreadNamed(name);
    setDraft("");
  }

  return (
    <>
      <main className="chrome mx-auto max-w-2xl pb-32">
        <header className="safe-top px-6 pt-7">
          <div className="num text-micro tracking-[0.18em] text-faint">
            WHAT THE DAYS ARE FOR
          </div>
          <h1 className="display mt-1.5 text-title text-deep">Goals</h1>
          <div className="mt-6 border-t border-rule pt-4 text-micro text-faint">
            Bars show the last seven days against the commitment you set.
          </div>
        </header>

        <div className="mt-6 px-6">
          {loading ? (
            <div className="num text-micro text-faint">LOADING</div>
          ) : threads.length === 0 ? (
            <p className="text-fine text-faint">
              No goals yet. Add one below, or type <span className="num">#name</span>{" "}
              when adding a block and it will be created for you.
            </p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {threads.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    spentMin={week.get(t.id) ?? 0}
                    open={openId === t.id}
                    onToggle={() => setOpenId(openId === t.id ? null : t.id)}
                    onPatch={(patch) => patchThread(t.id, patch)}
                    onArchive={() => {
                      archiveThread(t.id);
                      setOpenId(null);
                    }}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </main>

      <div className="above-tabs border-t border-rule bg-paper/92 backdrop-blur-sm">
        <form onSubmit={create} className="mx-auto max-w-2xl px-6 py-3.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New goal…"
            enterKeyHint="done"
            aria-label="Add a goal"
            className="w-full rounded-edge bg-sunk px-3 py-3 text-base text-deep ring-1 ring-rule outline-none transition-shadow placeholder:text-faint/60 focus:shadow-lift focus:ring-accent/40"
          />
        </form>
      </div>
    </>
  );
}

function ThreadRow({
  thread,
  spentMin,
  open,
  onToggle,
  onPatch,
  onArchive,
}: {
  thread: Thread;
  spentMin: number;
  open: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<Omit<Thread, "id">>) => void;
  onArchive: () => void;
}) {
  const [name, setName] = useState(thread.name);
  const target = thread.weeklyTargetMin ?? 0;
  const colour = threadColor(thread.colorIndex);
  const ratio = target > 0 ? Math.min(1, spentMin / target) : 0;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className="border-b border-grid py-4"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 text-left"
      >
        {/* The same vertical stroke the ribbon uses, so a goal looks the same
            wherever it appears. */}
        <span
          className="h-9 w-[3px] shrink-0"
          style={{ background: colour }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lede text-deep">
            {thread.name}
          </span>
          <span className="num mt-0.5 block text-micro text-faint">
            {spentMin > 0 ? formatDuration(spentMin) : "nothing"} this week
            {target > 0 && ` · of ${formatDuration(target)}`}
          </span>
        </span>
        <Icon
          name="chevron"
          size={14}
          className={`shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {target > 0 && (
        <div className="mt-3 ml-[calc(0.75rem+3px)] h-1 overflow-hidden rounded-plate bg-sunk">
          <motion.div
            className="h-full"
            style={{ background: colour }}
            initial={false}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ type: "spring", stiffness: 260, damping: 34 }}
          />
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="overflow-hidden"
          >
            <div className="pt-4 pl-[calc(0.75rem+3px)]">
              <Field label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => {
                    const next = name.trim();
                    if (next && next !== thread.name) onPatch({ name: next });
                    else setName(thread.name);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  aria-label="Goal name"
                  className="w-full rounded-edge bg-sunk px-3 py-2 text-base text-deep ring-1 ring-rule outline-none focus:ring-accent/40"
                />
              </Field>

              <Field label="Colour">
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
              </Field>

              <Field label="A week should give it">
                <div className="flex flex-wrap gap-1.5">
                  {TARGETS.map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() =>
                        onPatch({ weeklyTargetMin: min === 0 ? null : min })
                      }
                      aria-pressed={target === min}
                      className={`rounded-edge px-3 py-2 text-fine transition-colors ${
                        target === min
                          ? "bg-accent-soft text-accent ring-1 ring-accent/40"
                          : "text-ink ring-1 ring-rule hover:bg-sunk"
                      }`}
                    >
                      {min === 0 ? "No target" : formatDuration(min)}
                    </button>
                  ))}
                </div>
              </Field>

              <button
                type="button"
                onClick={onArchive}
                className="mt-5 flex items-center gap-2 text-fine text-faint transition-colors hover:text-over"
              >
                <Icon name="close" size={14} />
                Retire this goal
              </button>
              <p className="mt-1.5 text-micro text-faint">
                Past days keep it. It just stops appearing on new blocks.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-micro tracking-[0.18em] text-faint uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}
