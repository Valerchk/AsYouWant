"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { LoadFailure } from "@/components/LoadFailure";
import { ListSkeleton } from "@/components/Skeleton";
import {
  DayCrossSection,
  type Strand,
} from "@/components/review/DayCrossSection";
import { addDays, formatDuration, localDay } from "@/lib/time";
import { threadColor } from "@/lib/threads";
import { blockLook } from "@/lib/blocks/look";
import { useNowMin, CLOCK_NOT_READY } from "@/lib/useNow";
import { useDay } from "@/lib/data/useDay";

/* The evening cut. Where the day actually went, as opposed to where it was
   supposed to go. Linked from the evening notification. */

export default function Review() {
  const nowMin = useNowMin();
  if (nowMin === CLOCK_NOT_READY) return <ListSkeleton title={112} rows={4} />;
  return <ReviewScreen nowMin={nowMin} />;
}

function ReviewScreen({ nowMin }: { nowMin: number }) {
  const [today] = useState(() => localDay());
  const [date, setDate] = useState(today);
  const { day, loading, error, patchBlock, carryTo } = useDay(date, nowMin);

  const { strands, doneMin, doneCount, unfinished } = useMemo(() => {
    const blocks = day?.blocks ?? [];
    const done = blocks.filter((b) => b.status === "done");

    /* Blocks that belong to a goal are gathered under it; blocks that belong
       to nothing stand for themselves, wearing the colour they were given.
       Lumping the latter into one grey "Unthreaded" ring made the cut useless
       for anyone who simply colours their blocks and keeps no goals — which,
       now that a block needs no goal to have a face, is most people. */
    const groups = new Map<string, Strand>();
    for (const b of done) {
      const spent =
        b.actualEndMin !== null && b.actualStartMin !== null
          ? b.actualEndMin - b.actualStartMin
          : b.plannedMin;
      const thread = day?.threads.find((t) => t.id === b.threadId) ?? null;
      const key = thread ? `t:${thread.id}` : `b:${b.id}`;
      const seen = groups.get(key);
      if (seen) {
        seen.minutes += spent;
        continue;
      }
      groups.set(key, {
        key,
        threadId: thread?.id ?? null,
        name: thread?.name ?? b.title,
        colorIndex: blockLook(b, thread).colorIndex,
        minutes: spent,
      });
    }

    const list: Strand[] = [...groups.values()]
      // Thickest first, so the ring nearest the core is what the day was for.
      .sort((a, b) => b.minutes - a.minutes);

    return {
      strands: list,
      doneMin: done.reduce(
        (sum, b) =>
          sum +
          (b.actualEndMin !== null && b.actualStartMin !== null
            ? b.actualEndMin - b.actualStartMin
            : b.plannedMin),
        0,
      ),
      doneCount: done.length,
      unfinished: blocks.filter(
        (b) => b.status === "planned" || b.status === "active",
      ),
    };
  }, [day?.blocks, day?.threads]);

  if (error) return <LoadFailure what="your day" message={error} />;

  if (loading || !day) return <ListSkeleton title={112} rows={4} />;

  const untouched = (day.threads ?? []).filter(
    (t) => !strands.some((s) => s.threadId === t.id),
  );
  const goalsFed = strands.filter((s) => s.threadId !== null).length;

  return (
    <main className="chrome mx-auto max-w-2xl px-6 pb-32">
      <header className="safe-top pt-7">
        <div className="num text-micro tracking-[0.18em] text-faint">
          WHERE THE DAY WENT
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <h1 className="display text-title text-deep">The cut</h1>
          {/* A cut of one day says nothing about whether it was a good one.
              The arrows are what make it a record rather than a snapshot. */}
          <div className="-mr-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDate(addDays(date, -1))}
              aria-label="Previous day"
              className="flex h-9 w-8 items-center justify-center text-faint transition-colors hover:text-ink"
            >
              <Icon name="chevron" size={15} className="rotate-180" />
            </button>
            <span className="num min-w-[74px] text-center text-micro text-ink">
              {date === today ? "today" : date.slice(5)}
            </span>
            <button
              type="button"
              onClick={() => setDate(addDays(date, 1))}
              disabled={date >= today}
              aria-label="Next day"
              className="flex h-9 w-8 items-center justify-center text-faint transition-colors hover:text-ink disabled:opacity-30"
            >
              <Icon name="chevron" size={15} />
            </button>
          </div>
        </div>
      </header>

      {doneCount === 0 ? (
        <div className="mt-10">
          <p className="text-lede leading-7 text-ink">
            Nothing closed today.
          </p>
          <p className="mt-3 text-base leading-7 text-faint">
            That happens. The useful question is whether the plan was wrong or
            the day was — and tomorrow is where you answer it.
          </p>
          <Link
            href="/today"
            className="mt-7 inline-flex items-center gap-2 rounded-edge bg-accent px-4 py-2.5 text-fine text-paper transition-shadow hover:shadow-lift"
          >
            Back to the day
            <Icon name="chevron" size={14} />
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-9">
            <DayCrossSection strands={strands} />
          </div>

          <p className="mt-8 text-center text-lede leading-7 text-deep">
            {formatDuration(doneMin)} closed
            {goalsFed > 0 &&
              `, feeding ${goalsFed === 1 ? "one goal" : `${goalsFed} goals`}`}
            .
          </p>

          <ul className="mt-8">
            {strands.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-3 border-b border-grid py-3"
              >
                <span
                  className="h-6 w-[3px] shrink-0"
                  style={{
                    background:
                      s.colorIndex === null
                        ? "var(--color-rule)"
                        : threadColor(s.colorIndex),
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-base text-ink">
                  {s.name}
                </span>
                <span className="num shrink-0 text-fine text-deep">
                  {formatDuration(s.minutes)}
                </span>
                <span className="num w-12 shrink-0 text-right text-micro text-faint">
                  {Math.round((s.minutes / doneMin) * 100)}%
                </span>
              </li>
            ))}
          </ul>

          {/* Naming what got nothing is the point of the cut. A day can be
              full and still feed none of what you said mattered. */}
          {untouched.length > 0 && (
            <div className="mt-8 rounded-plate bg-sunk/60 p-4">
              <div className="text-fine text-ink">
                Untouched today:{" "}
                <span className="text-deep">
                  {untouched.map((t) => t.name).join(", ")}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {unfinished.length > 0 && (
        <section className="mt-10 border-t border-rule pt-6">
          <h2 className="text-micro tracking-[0.18em] text-faint uppercase">
            Still open · {unfinished.length}
          </h2>
          <ul className="mt-3">
            {unfinished.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 border-b border-grid py-3"
              >
                <span className="min-w-0 flex-1 truncate text-base text-ink">
                  {b.title}
                </span>
                <span className="num shrink-0 text-micro text-faint">
                  {formatDuration(b.plannedMin)}
                </span>
                <button
                  type="button"
                  onClick={() => carryTo(b, addDays(date, 1))}
                  className="shrink-0 rounded-edge px-2.5 py-1.5 text-micro text-accent ring-1 ring-accent/30 transition-colors hover:bg-accent-soft"
                >
                  Move on
                </button>
                <button
                  type="button"
                  onClick={() => patchBlock(b.id, { status: "dropped" })}
                  className="shrink-0 rounded-edge px-2.5 py-1.5 text-micro text-faint ring-1 ring-rule transition-colors hover:bg-sunk"
                >
                  Let go
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-micro text-faint">
            Moving a block on puts it whole on the next day. Letting go closes
            it here — the day is a record, and it should say what happened.
          </p>
        </section>
      )}
    </main>
  );
}
