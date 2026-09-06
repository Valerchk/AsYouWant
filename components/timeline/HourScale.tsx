"use client";

import { yForMinute, type Geometry } from "@/lib/timeline/geometry";
import { CLOCK_W } from "./motion";

/* ==========================================================================
   The hour scale.
   --------------------------------------------------------------------------
   The left gutter used to print one time per block, which made it a column of
   labels — the same information the block already carried, in a worse place.
   It is a ruled scale now: every hour marked down the whole day, whether or
   not anything is planned there. That is what turns the ribbon from a list
   into an instrument, and it is why an empty afternoon still looks like an
   afternoon rather than like nothing.

   Positions come from `yForMinute`, never from arithmetic on minutes. The
   ribbon compresses empty stretches, so the scale is deliberately non-linear:
   marks crowd together exactly where the day has been folded, which is an
   honest picture of a folded day and quietly shows where the folding is.
   ========================================================================== */

/** Pixels a label needs to itself before the next one may be drawn. */
const LABEL_CLEARANCE = 30;
/** Pixels a bare tick needs, which is far less. */
const TICK_CLEARANCE = 7;

interface Mark {
  y: number;
  hour: boolean;
  label: string | null;
}

function buildMarks(geo: Geometry): Mark[] {
  const out: Mark[] = [];
  let lastLabelY = -Infinity;
  let lastTickY = -Infinity;

  // Half-hour steps, so the minor marks come out of the same walk.
  const first = Math.ceil(geo.startMin / 30) * 30;
  for (let min = first; min <= geo.endMin; min += 30) {
    const y = yForMinute(geo, min);
    if (y - lastTickY < TICK_CLEARANCE) continue;
    lastTickY = y;

    const hour = min % 60 === 0;
    // A label only where one will not collide with the last one printed.
    // Inside a folded stretch that means hours pass with a tick and no
    // number, which is the truthful reading: the ribbon is not showing them.
    const label =
      hour && y - lastLabelY >= LABEL_CLEARANCE
        ? String(Math.floor(min / 60) % 24).padStart(2, "0")
        : null;
    if (label) lastLabelY = y;

    out.push({ y, hour, label });
  }
  return out;
}

export function HourScale({ geo }: { geo: Geometry }) {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 left-0 select-none"
      style={{ width: CLOCK_W }}
      aria-hidden
    >
      {buildMarks(geo).map((m, i) => (
        <div key={i} className="absolute right-0" style={{ top: m.y }}>
          <span
            className="absolute right-1 block h-px -translate-y-1/2"
            style={{
              width: m.hour ? 7 : 4,
              background: m.hour ? "var(--color-rule)" : "var(--color-grid)",
            }}
          />
          {m.label && (
            <span className="num absolute right-3 -translate-y-1/2 text-micro leading-none text-faint">
              {m.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
