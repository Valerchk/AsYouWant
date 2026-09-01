"use client";

import { useSyncExternalStore } from "react";

/* ==========================================================================
   The wall clock, as minutes from local midnight.
   --------------------------------------------------------------------------
   Written as an external store rather than state-plus-effect for two reasons:
   the snapshot is a plain number, so React re-renders only when the minute
   actually changes rather than on every tick; and the server snapshot gives
   us a single unambiguous "not mounted yet" value, which keeps the clock from
   causing a hydration mismatch.

   It used to poll every thirty seconds, which is the reason the header read a
   different time from the phone's own status bar: a fixed interval drifts off
   the minute boundary and then stays off, so the app could sit on 14:31 for
   twenty-nine seconds after the phone had moved to 14:32. It now sleeps until
   the boundary itself and re-aims after every wake.

   Waking matters as much as sleeping. A backgrounded tab has its timers
   throttled or frozen outright — on an installed iOS app, for hours — so
   returning to it would otherwise show whatever minute it was when you left.
   ========================================================================== */

const NOT_MOUNTED = -1;

/** Milliseconds until the next whole minute, with a hair of margin.
 *
 *  Minute boundaries line up in every timezone, including the half-hour and
 *  quarter-hour ones, because their offsets are themselves whole minutes —
 *  so this can be computed from epoch time without knowing the zone. */
function untilNextMinute(): number {
  return 60_000 - (Date.now() % 60_000) + 25;
}

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;

  const tick = () => {
    onChange();
    // Re-aimed every time rather than set once: a timeout that fires late —
    // and under load they all do — must not push every later one late too.
    timer = setTimeout(tick, untilNextMinute());
  };

  timer = setTimeout(tick, untilNextMinute());

  // Coming back from the background: read the clock now, then re-aim.
  const resync = () => {
    if (document.visibilityState === "hidden") return;
    clearTimeout(timer);
    tick();
  };

  document.addEventListener("visibilitychange", resync);
  window.addEventListener("focus", resync);
  // Fired when a page is restored from the back/forward cache, where every
  // timer was suspended rather than merely slowed.
  window.addEventListener("pageshow", resync);

  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", resync);
    window.removeEventListener("focus", resync);
    window.removeEventListener("pageshow", resync);
  };
}

function getSnapshot(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function getServerSnapshot(): number {
  return NOT_MOUNTED;
}

/** Returns CLOCK_NOT_READY until mounted on the client. */
export function useNowMin(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const CLOCK_NOT_READY = NOT_MOUNTED;
