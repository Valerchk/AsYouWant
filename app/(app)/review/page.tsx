"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons/Icon";
import { LoadFailure } from "@/components/LoadFailure";
import {
  DayCrossSection,
  type Strand,
} from "@/components/review/DayCrossSection";
import { formatDuration } from "@/lib/time";
import { threadColor } from "@/lib/threads";
import { useNowMin, CLOCK_NOT_READY } from "@/lib/useNow";
import { useDay } from "@/lib/data/useDay";

/* The evening cut. Where the day actually went, as opposed to where it was
   supposed to go. Linked from the evening notification. */

export default function Review() {
  const nowMin = useNowMin();
  if (nowMin === CLOCK_NOT_READY) return <main className="min-h-dvh bg-paper" />;
  return <ReviewScreen nowMin={nowMin} />;
}

function ReviewScreen({ nowMin }: { nowMin: number }) {
  const { day, loading, error, patchBlock } = useDay(nowMin);

  const { strands, doneMin, doneCount, unfinished } = useMemo(() => {
    const blocks = day?.blocks ?? [];
    const done = blocks.filter((b) => b.status === "done");

    const byThread = new Map<string | null, number>();
    for (const b of done) {
      const spent =
        b.actualEndMin !== null && b.actualStartMin !== null
          ? b.actualEndMin - b.actualStartMin
          : b.plannedMin;
      byThread.set(b.threadId, (byThread.get(b.threadId) ?? 0) + spent);
    }

    const list: Strand[] = [...byThread.entries()]
      .map(([threadId, minutes]) => {
        const thread = day?.threads.find((t) => t.id === threadId);
        return {
          threadId,
          name: thread?.name ?? "Unthreaded",
          colorIndex: thread?.colorIndex ?? 0,
          minutes,
        };
      })
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

  if (loading || !day) {
    return (
      <main className="chrome mx-auto max-w-2xl px-6 pt-7">
        <div className="num text-micro text-faint">LOADING</div>
      </main>
    );
  }

  const untouched = (day.threads ?? []).filter(
    (t) => !strands.some((s) => s.threadId === t.id),
  );

  return (
    <main className="chrome mx-auto max-w-2xl px-6 pb-32">
      <header className="safe-top pt-7">
        <div className="num text-micro tracking-[0.18em] text-faint">
          WHERE THE DAY WENT
        </div>
        <h1 className="display mt-1.5 text-title text-deep">The cut</h1>
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
            {formatDuration(doneMin)} closed, across{" "}
            {strands.length === 1 ? "one goal" : `${strands.length} goals`}.
          </p>

          <ul className="mt-8">
            {strands.map((s) => (
              <li
                key={s.threadId ?? "none"}
                className="flex items-center gap-3 border-b border-grid py-3"
              >
                <span
                  className="h-6 w-[3px] shrink-0"
                  style={{
                    background: s.threadId
                      ? threadColor(s.colorIndex)
                      : "var(--color-rule)",
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
                  onClick={() => patchBlock(b.id, { status: "carried" })}
                  className="shrink-0 rounded-edge px-2.5 py-1.5 text-micro text-accent ring-1 ring-accent/30 transition-colors hover:bg-accent-soft"
                >
                  Take it off
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-micro text-faint">
            Taking a block off clears it from today. It is not moved to
            tomorrow — that would be a promise this app cannot keep yet.
          </p>
        </section>
      )}
    </main>
  );
}
