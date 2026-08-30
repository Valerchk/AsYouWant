"use client";

import { useSyncExternalStore } from "react";

/* The wall clock, as minutes from local midnight.

   Written as an external store rather than state-plus-effect for two reasons:
   the snapshot is a plain number, so React re-renders only when the minute
   actually changes rather than on every tick; and the server snapshot gives
   us a single unambiguous "not mounted yet" value, which keeps the clock from
   causing a hydration mismatch. */

const NOT_MOUNTED = -1;

function subscribe(onChange: () => void) {
  // Twice a minute: fast enough that the now-line never looks stuck, cheap
  // enough to leave running all day.
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
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
