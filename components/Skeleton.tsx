"use client";

import { CLOCK_W, RAIL_W } from "@/components/timeline/motion";

/* ==========================================================================
   Waiting, drawn.
   --------------------------------------------------------------------------
   The word LOADING used to sit alone in the top-left corner of an otherwise
   empty screen, and then the whole day appeared at once underneath it. Two
   things were wrong with that. It gave no clue how much was coming, so the
   arrival read as a jolt rather than as a page finishing; and before it there
   was a frame of pure paper — the clock has to mount before anything can be
   laid out — so every load flashed blank, then flashed a word, then filled.

   These stand in the shape of what is coming. The header keeps its rhythm,
   the ribbon keeps its rail and its clock gutter, and the rows are the
   heights real blocks are. Nothing moves when the day lands except ink
   arriving where the grey was.
   ========================================================================== */

/** One bar of absent text. */
function Bar({
  w,
  h = 12,
  className = "",
}: {
  w: number | string;
  h?: number;
  className?: string;
}) {
  return (
    <span
      className={`sweep block rounded-hair ${className}`}
      style={{ width: typeof w === "number" ? `${w}px` : w, height: h }}
    />
  );
}

/** The day: header, then a ribbon of blocks on the rail. */
export function DaySkeleton() {
  return (
    <main
      className="chrome mx-auto max-w-2xl"
      style={{ paddingBottom: 160 }}
      aria-busy="true"
      aria-label="Loading your day"
    >
      <header className="safe-top px-6 pt-4">
        {/* the week strip */}
        <div className="flex justify-between gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <Bar w="60%" h={8} />
              <Bar w="45%" h={16} />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-3">
          <div>
            <Bar w={132} h={26} />
            <Bar w={92} h={24} className="mt-2" />
          </div>
          <div className="ml-auto flex gap-2">
            <Bar w={22} h={22} />
            <Bar w={22} h={22} />
          </div>
        </div>

        <div className="mt-3 flex gap-3 border-t border-rule pt-3">
          <Bar w={58} h={10} />
          <Bar w={34} h={10} />
          <Bar w={70} h={10} />
        </div>
      </header>

      <div className="relative mt-9 px-6">
        {/* The rail, exactly where the real one runs, so it does not shift. */}
        <div
          className="absolute top-0 bottom-0 w-px bg-grid"
          style={{ left: 24 + CLOCK_W + RAIL_W / 2 }}
        />
        {[92, 64, 116, 64].map((h, i) => (
          <div
            key={i}
            className="relative mb-[2px] grid"
            style={{
              height: h,
              gridTemplateColumns: `${CLOCK_W}px ${RAIL_W}px minmax(0,1fr)`,
            }}
          >
            <div className="pt-3 pr-2.5">
              <Bar w="100%" h={10} />
            </div>
            <div className="relative">
              <span
                className="sweep absolute left-1/2 h-[18px] w-[18px] -translate-x-1/2 rounded-plate"
                style={{ top: 2 }}
              />
            </div>
            <div className="rounded-edge bg-sunk/60 px-3 pt-3">
              <Bar w={`${52 + ((i * 17) % 34)}%`} h={14} />
              <Bar w={68} h={10} className="mt-2.5" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

/** Anything that is a column of rows: the inbox, settings, the review. */
export function ListSkeleton({
  title = 120,
  rows = 5,
}: {
  /** Width of the heading bar, so each screen keeps its own proportions. */
  title?: number;
  rows?: number;
}) {
  return (
    <main
      className="chrome mx-auto max-w-2xl px-6 pb-32"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="safe-top pt-6">
        <Bar w={title} h={26} />
        <Bar w={168} h={11} className="mt-3" />
      </div>
      <div className="mt-8">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-grid py-4">
            <Bar w={18} h={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <Bar w={`${88 - ((i * 13) % 42)}%`} h={14} />
              <Bar w={72} h={10} className="mt-2.5" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
