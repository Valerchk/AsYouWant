/* ==========================================================================
   Temporary local store.
   --------------------------------------------------------------------------
   Stands in for Supabase until the database is connected, so the app can be
   used and judged as an app rather than as a demo that forgets everything on
   reload.

   Reached only through lib/data/localStore.ts, which implements the same
   DayStore interface as the Supabase version — so the screens never learn
   which one is answering.
   ========================================================================== */

import type { Block } from "@/lib/timeline/engine";
import type { Thread } from "@/lib/threads";

const KEY = "ayw.day.v1";

export interface DayState {
  /** YYYY-MM-DD the state belongs to, so a new day reseeds. */
  date: string;
  blocks: Block[];
  threads: Thread[];
  confirmed: boolean;
}

export const DAY_START_MIN = 8 * 60;
export const DAY_END_MIN = 22 * 60;

/**
 * The day's bounds, widened to contain the current moment.
 *
 * A fixed 08:00–22:00 window means someone opening the app at 23:13 sees an
 * empty ribbon and every block in overflow — the app declaring their day over
 * while they are visibly still in it. If you are awake, the day is still
 * running, so the window stretches rather than the day ending.
 */
export function dayWindow(nowMin: number): { start: number; end: number } {
  return {
    start: Math.max(0, Math.min(DAY_START_MIN, nowMin - 120)),
    end: Math.min(1440, Math.max(DAY_END_MIN, nowMin + 180)),
  };
}

const THREADS: Thread[] = [
  { id: "t1", name: "Thesis", colorIndex: 0 },
  { id: "t2", name: "Work", colorIndex: 3 },
  { id: "t3", name: "Health", colorIndex: 2 },
  { id: "t4", name: "Reading", colorIndex: 5 },
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

let counter = 0;

/**
 * An id that works everywhere.
 *
 * `crypto.randomUUID()` exists only in a secure context, so calling it
 * directly throws on a plain-http LAN address — exactly how the app gets
 * opened from a phone during development. Everything that mints a block id
 * must come through here.
 */
export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  counter += 1;
  return `b${Date.now()}-${counter}`;
}

function make(over: Partial<Block>): Block {
  return {
    id: newId(),
    title: "Block",
    kind: "flow",
    startMin: null,
    plannedMin: 60,
    status: "planned",
    sortOrder: 0,
    threadId: null,
    actualStartMin: null,
    actualEndMin: null,
    ...over,
  };
}

/**
 * A believable day built around the current moment, so the ribbon shows every
 * state it can be in — finished early, running, anchored, still to come —
 * whatever time it happens to be opened.
 */
export function seedDay(nowMin: number): Block[] {
  const blocks: Block[] = [];
  const { start: winStart, end: winEnd } = dayWindow(nowMin);
  const fits = (start: number, len: number) =>
    start >= winStart && start + len <= winEnd;

  // Behind: finished eighteen minutes early, which is what puts a
  // "+18 min free" mark on the ribbon.
  const doneStart = nowMin - 150;
  if (fits(doneStart, 90)) {
    blocks.push(
      make({
        title: "Thesis — chapter 3",
        plannedMin: 90,
        status: "done",
        sortOrder: 1,
        threadId: "t1",
        actualStartMin: doneStart,
        actualEndMin: doneStart + 72,
      }),
    );
  }

  // Running now.
  const activeStart = nowMin - 25;
  if (fits(activeStart, 60)) {
    blocks.push(
      make({
        title: "Review pull requests",
        plannedMin: 60,
        status: "active",
        sortOrder: 2,
        threadId: "t2",
        actualStartMin: activeStart,
      }),
    );
  }

  // Ahead: an anchor, then elastic work behind it.
  const standup = Math.round((nowMin + 95) / 15) * 15;
  if (fits(standup, 30)) {
    blocks.push(
      make({
        title: "Standup",
        kind: "anchor",
        startMin: standup,
        plannedMin: 30,
        sortOrder: 3,
        threadId: "t2",
      }),
    );
  }

  blocks.push(
    make({ title: "Write intro", plannedMin: 45, sortOrder: 4, threadId: "t1" }),
  );

  const gym = Math.round((nowMin + 300) / 30) * 30;
  if (fits(gym, 60)) {
    blocks.push(
      make({
        title: "Gym",
        kind: "anchor",
        startMin: gym,
        plannedMin: 60,
        sortOrder: 5,
        threadId: "t3",
      }),
    );
  }

  blocks.push(
    make({ title: "Read — Perec", plannedMin: 40, sortOrder: 6, threadId: "t4" }),
  );

  return blocks;
}

export function loadDay(nowMin: number): DayState {
  const fresh: DayState = {
    date: todayKey(),
    blocks: seedDay(nowMin),
    threads: THREADS,
    confirmed: false,
  };

  if (typeof window === "undefined") return fresh;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as DayState;
    // A stored day from yesterday is not this day.
    if (parsed.date !== fresh.date) return fresh;
    return { ...fresh, ...parsed, threads: parsed.threads ?? THREADS };
  } catch {
    // Corrupt or unreadable storage should never block the app from opening.
    return fresh;
  }
}

export function saveDay(state: DayState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode, or the quota is full. Losing persistence is survivable;
    // throwing here would not be.
  }
}

export function resetDay(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
