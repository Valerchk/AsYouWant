"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GoalSheet } from "@/components/GoalSheet";
import { LoadFailure } from "@/components/LoadFailure";
import { ListSkeleton } from "@/components/Skeleton";
import { Icon } from "@/components/icons/Icon";
import { GoalIcon, isGoalIcon } from "@/components/icons/GoalIcon";
import { daysBetween, formatDuration, localDay, weekOf } from "@/lib/time";
import { threadColor, type Thread } from "@/lib/threads";
import { useNowMin, CLOCK_NOT_READY } from "@/lib/useNow";
import { dayStore } from "@/lib/data";
import { useDay } from "@/lib/data/useDay";
import type { Spend } from "@/lib/data/types";

/* ==========================================================================
   Goals — the long view.
   --------------------------------------------------------------------------
   A goal is not a thing you do on Tuesday. It is what a week or a month was
   for, and it only becomes legible over that length of time, which is why it
   now has a horizon control and its own tab rather than a row in the header
   of a single day.

   It was a tab once before and it was wrong then, for a reason that no longer
   holds: a block could not be given a colour, an icon or a name of its own
   until a goal existed, so this screen was a gate in front of planning
   anything. Blocks carry their own look now. Nothing on the day needs
   anything here, and a person who never opens this tab loses nothing.
   ========================================================================== */

type Span = "week" | "month";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** First and last day of the calendar month `day` falls in. */
function monthOf(day: string): [string, string] {
  const [y, m] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(last)}`];
}

function rangeFor(span: Span, today: string): [string, string] {
  if (span === "month") return monthOf(today);
  const week = weekOf(today);
  return [week[0], week[6]];
}

function nameRange(span: Span, from: string, to: string): string {
  const [, month] = from.split("-").map(Number);
  if (span === "month") return `${MONTHS[month - 1]} so far`;
  const day = (d: string) => Number(d.slice(8));
  return `${day(from)}–${day(to)} ${MONTHS[month - 1].slice(0, 3)}`;
}

export default function Goals() {
  const nowMin = useNowMin();
  if (nowMin === CLOCK_NOT_READY) return <ListSkeleton title={104} rows={4} />;
  return <GoalsScreen nowMin={nowMin} />;
}

function GoalsScreen({ nowMin }: { nowMin: number }) {
  const [today] = useState(() => localDay());
  const [span, setSpan] = useState<Span>("week");
  const [openId, setOpenId] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");

  // The day store is where goals live. Loading today first is not incidental:
  // the remote store learns which account it is speaking for during load, and
  // every other call depends on that.
  const { day, loading, error, patchThread, archiveThread, addThreadNamed } =
    useDay(today, nowMin);

  const [from, to] = useMemo(() => rangeFor(span, today), [span, today]);
  const [spend, setSpend] = useState<Spend | null>(null);

  /* Drop the old numbers the moment the horizon changes, during render rather
     than in an effect — an effect would paint one frame of the week's totals
     under the word "month" first. */
  const [shownRange, setShownRange] = useState(`${from}${to}`);
  if (shownRange !== `${from}${to}`) {
    setShownRange(`${from}${to}`);
    setSpend(null);
  }

  useEffect(() => {
    let alive = true;
    dayStore()
      .loadSpend(from, to)
      .then((s) => {
        if (alive) setSpend(s);
      })
      .catch(() => {
        // The bars go quiet; the list of goals is still the point.
      });
    return () => {
      alive = false;
    };
  }, [from, to]);

  if (error) return <LoadFailure what="your goals" message={error} />;
  if (loading || !day) return <ListSkeleton title={104} rows={4} />;

  const threads = day.threads;
  const totals = spend?.totals ?? new Map<string, number>();
  const closed = threads.reduce((sum, t) => sum + (totals.get(t.id) ?? 0), 0);
  const open = threads.find((t) => t.id === openId) ?? null;

  // A weekly target read over a month is a monthly target: the same promise,
  // counted for as long as the screen is counting.
  const weeks = (daysBetween(from, to) + 1) / 7;
  const targetFor = (t: Thread) =>
    t.weeklyTargetMin ? Math.round(t.weeklyTargetMin * weeks) : 0;

  function create() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    setNaming(false);
    addThreadNamed(name)
      // Straight into its own sheet: colour, icon and what a week owes it are
      // all one screen away rather than a hunt afterwards.
      .then((made) => setOpenId(made.id))
      .catch(() => {
        // useDay has already put the failure on screen.
      });
  }

  return (
    <>
      <main className="chrome mx-auto max-w-2xl px-6 pb-28">
        <header className="safe-top pt-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <h1 className="display text-title text-deep">Goals</h1>
              <p className="num mt-1 text-fine text-faint">
                {nameRange(span, from, to)} ·{" "}
                {closed > 0 ? `${formatDuration(closed)} closed` : "nothing closed"}
              </p>
            </div>

            {/* The horizon. A goal that reads as behind on Wednesday is often
                fine over a month, and the opposite happens too. */}
            <div className="ml-auto flex shrink-0 rounded-edge ring-1 ring-rule">
              {(["week", "month"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpan(s)}
                  aria-pressed={span === s}
                  className={`px-3 py-1.5 text-fine capitalize transition-colors ${
                    span === s ? "bg-accent-soft text-accent" : "text-faint"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </header>

        {threads.length === 0 ? (
          <Empty />
        ) : (
          <ul className="mt-7">
            {threads.map((t) => (
              <GoalRow
                key={t.id}
                thread={t}
                spentMin={totals.get(t.id) ?? 0}
                targetMin={targetFor(t)}
                share={closed > 0 ? (totals.get(t.id) ?? 0) / closed : 0}
                days={spend?.days ?? []}
                onOpen={() => setOpenId(t.id)}
              />
            ))}
          </ul>
        )}

        <div className="mt-7">
          <AnimatePresence initial={false} mode="wait">
            {naming ? (
              <motion.div
                key="naming"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") create();
                    if (e.key === "Escape") setNaming(false);
                  }}
                  // Directions, not errands. The examples do the work a
                  // sentence of instruction would have done badly.
                  placeholder="Work, Study, Health…"
                  aria-label="Name a new goal"
                  autoFocus
                  className="min-w-0 flex-1 rounded-edge bg-sunk px-3 py-2.5 text-base text-deep ring-1 ring-rule outline-none focus:ring-accent/40"
                />
                <button
                  type="button"
                  onClick={create}
                  disabled={!draft.trim()}
                  className="rounded-edge bg-accent px-4 py-2.5 text-fine text-paper disabled:bg-rule disabled:text-faint"
                >
                  Add
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="add"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setNaming(true)}
                className="flex w-full items-center gap-2.5 rounded-edge px-3 py-3 text-left text-fine text-ink ring-1 ring-rule transition-colors hover:bg-sunk"
              >
                <Icon name="plus" size={15} className="text-faint" />
                New goal
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </main>

      <GoalSheet
        thread={open}
        spentMin={openId ? (totals.get(openId) ?? 0) : 0}
        days={spend?.days ?? []}
        spanLabel={span}
        onClose={() => setOpenId(null)}
        onPatch={patchThread}
        onArchive={archiveThread}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function GoalRow({
  thread,
  spentMin,
  targetMin,
  share,
  days,
  onOpen,
}: {
  thread: Thread;
  spentMin: number;
  /** Scaled to the span on screen; zero when the goal promises nothing. */
  targetMin: number;
  /** Its slice of everything closed, used when there is no target. */
  share: number;
  days: Spend["days"];
  onOpen: () => void;
}) {
  const colour = threadColor(thread.colorIndex);
  const ratio = targetMin > 0 ? Math.min(1, spentMin / targetMin) : share;
  const values = days.map((d) => d.byThread.get(thread.id) ?? 0);
  // Floored at an hour so one ten-minute day does not draw a full column.
  const peak = Math.max(60, ...values);

  return (
    <li className="border-b border-grid">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3.5 py-4 text-left"
      >
        <span
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-edge"
          style={{
            background: `color-mix(in oklab, ${colour} 20%, var(--color-paper))`,
          }}
        >
          {isGoalIcon(thread.icon) ? (
            <GoalIcon name={thread.icon} size={19} style={{ color: colour }} />
          ) : (
            <span className="h-[3px] w-4" style={{ background: colour }} />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-lede text-ink">
              {thread.name}
            </span>
            <span className="num shrink-0 text-fine text-faint">
              {spentMin > 0 ? formatDuration(spentMin) : "—"}
              {targetMin > 0 && (
                <span className="text-faint">
                  {" / "}
                  {formatDuration(targetMin)}
                </span>
              )}
            </span>
          </span>

          <span className="mt-2 block h-1 overflow-hidden rounded-plate bg-sunk">
            <motion.span
              className="block h-full"
              style={{ background: colour }}
              initial={false}
              animate={{ width: `${ratio * 100}%` }}
              transition={{ type: "spring", stiffness: 260, damping: 34 }}
            />
          </span>

          {/* One column per day. A total cannot tell an hour a day apart from
              seven hours on Sunday, and those are different weeks. */}
          {values.length > 0 && (
            <span
              className="mt-2.5 flex items-end gap-[3px]"
              style={{ height: 22 }}
            >
              {values.map((v, i) => (
                <motion.span
                  key={days[i].date}
                  className="flex-1 rounded-t-hair"
                  style={{ background: v > 0 ? colour : "var(--color-sunk)" }}
                  initial={false}
                  animate={{ height: Math.max(2, (v / peak) * 20) }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              ))}
            </span>
          )}
        </span>

        <Icon name="chevron" size={14} className="mt-1.5 shrink-0 text-faint" />
      </button>
    </li>
  );
}

function Empty() {
  return (
    <div className="mt-8 max-w-md">
      <p className="text-base leading-7 text-ink">
        No goals yet, and the day works perfectly well without them. Blocks
        carry their own colour, so nothing here is a prerequisite for anything
        there.
      </p>
      <p className="mt-4 text-base leading-7 text-faint">
        A goal is worth making when you want to know where a whole week went —
        <em> Work</em>, <em>Study</em>, <em>Health</em>. Tell a block it is part
        of one, and this page starts keeping the count.
      </p>
    </div>
  );
}
