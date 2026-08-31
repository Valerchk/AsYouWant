"use client";

import { useEffect, useState } from "react";
import type { Block } from "@/lib/timeline/engine";
import { usingDatabase } from "./index";

/* The day's calendar events, as blocks the ribbon can lay out.

   They are marked `external`, which is the whole contract: the engine counts
   their hours so free time stops being a lie, and every control above the
   engine refuses to touch them. They are never stored — this is a window onto
   someone else's record, not a copy of it. */

interface Wire {
  uid: string;
  title: string;
  startMin: number;
  endMin: number;
}

function toBlock(event: Wire): Block {
  return {
    id: `ics:${event.uid}`,
    title: event.title,
    kind: "anchor",
    startMin: event.startMin,
    plannedMin: Math.max(1, event.endMin - event.startMin),
    status: "planned",
    // Sorted before everything authored here, though it never matters: an
    // anchor is placed by its hour, not by its order.
    sortOrder: -1,
    threadId: null,
    actualStartMin: null,
    actualEndMin: null,
    external: true,
  };
}

export function useCalendar(date: string): {
  events: Block[];
  error: string | null;
} {
  const [events, setEvents] = useState<Block[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Without an account there is no profile to hold the subscription.
    if (!usingDatabase()) return;

    let alive = true;
    const controller = new AbortController();

    fetch(`/api/calendar?day=${encodeURIComponent(date)}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((data: { events?: Wire[]; error?: string }) => {
        if (!alive) return;
        setError(data.error ?? null);
        setEvents((data.events ?? []).map(toBlock));
      })
      .catch(() => {
        // A calendar that will not load must never take the day down with it.
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [date]);

  return { events, error };
}
