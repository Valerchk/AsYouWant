"use client";

import { useCallback, useEffect, useState } from "react";
import type { Block } from "@/lib/timeline/engine";
import type { Thread } from "@/lib/threads";
import type { Routine, RoutineInput } from "@/lib/routines";
import { carriedCopy } from "@/lib/timeline/actions";
import { dayStore } from "./index";
import type { DayData, NewBlock } from "./types";

/* One day, from whichever store is configured. Screens use this and never
   touch Supabase or localStorage themselves, so connecting the database is a
   change to lib/data alone.

   The day is a parameter now rather than an assumption. Everything that
   follows from being able to name another date — planning tomorrow evening,
   carrying what did not happen, looking back at yesterday — needed only that
   one word to stop being impossible. */

export interface UseDay {
  day: DayData | null;
  routines: Routine[];
  loading: boolean;
  error: string | null;
  addBlock: (block: NewBlock) => void;
  /** Lay a whole template down in one go. */
  addBlocks: (blocks: NewBlock[]) => void;
  patchBlock: (id: string, patch: Partial<Block>) => void;
  /** New order for the flow queue, first to last. */
  reorderFlow: (ids: string[]) => void;
  /** Move a block to another date, leaving a carried marker behind. */
  carryTo: (block: Block, toDay: string) => void;
  confirmDay: () => void;
  deleteBlock: (id: string) => void;
  patchThread: (id: string, patch: Partial<Omit<Thread, "id">>) => void;
  archiveThread: (id: string) => void;
  /** Create a goal on its own. Resolves with it, so the composer can select
      the goal it just made without waiting for a re-render to find it. */
  addThreadNamed: (name: string) => Promise<Thread>;
  /**
   * Add a block, creating its goal first if the #tag names one that does not
   * exist yet. Without this, a fresh account — which has no threads at all —
   * would silently drop every tag someone typed.
   */
  addBlockWithThread: (block: NewBlock, threadName: string | null) => void;
  saveRoutine: (input: RoutineInput, id?: string) => Promise<Routine>;
  deleteRoutine: (id: string) => void;
}

export function useDay(date: string, nowMin: number): UseDay {
  // Pinned at mount: the clock ticks every minute, and the day must not
  // reload underneath the person each time it does.
  const [initialNow] = useState(nowMin);
  const [day, setDay] = useState<DayData | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  /* Clearing the day the moment the date changes, during render rather than
     in an effect. An effect would paint one frame of Wednesday under
     Thursday's heading first, and setting state from an effect body cascades
     a second render for no reason. */
  const [shownDate, setShownDate] = useState(date);
  if (shownDate !== date) {
    setShownDate(date);
    setDay(null);
  }

  useEffect(() => {
    let alive = true;
    dayStore()
      .load(date, initialNow)
      .then((d) => {
        if (alive) setDay(d);
      })
      .catch((e: unknown) => {
        if (alive) fail(e);
      });
    return () => {
      alive = false;
    };
  }, [date, initialNow, fail]);

  useEffect(() => {
    let alive = true;
    dayStore()
      .listRoutines()
      .then((list) => {
        if (alive) setRoutines(list);
      })
      .catch(() => {
        // Routines are an addition to a day that works without them.
      });
    return () => {
      alive = false;
    };
  }, []);

  const addBlock = useCallback(
    (block: NewBlock) => {
      dayStore()
        .addBlock(block, date)
        .then((created) => {
          setDay((d) => (d ? { ...d, blocks: [...d.blocks, created] } : d));
        })
        .catch(fail);
    },
    [date, fail],
  );

  const addBlocks = useCallback(
    (blocks: NewBlock[]) => {
      const store = dayStore();
      // Sequential rather than parallel: each insert takes the next sort order,
      // and the remote store counts them as it goes.
      blocks
        .reduce<Promise<Block[]>>(
          (chain, b) =>
            chain.then(async (acc) => [...acc, await store.addBlock(b, date)]),
          Promise.resolve([]),
        )
        .then((created) => {
          setDay((d) => (d ? { ...d, blocks: [...d.blocks, ...created] } : d));
        })
        .catch(fail);
    },
    [date, fail],
  );

  const patchBlock = useCallback(
    (id: string, patch: Partial<Block>) => {
      // Applied on screen first: closing a block is the most frequent action of
      // the day, and it must feel instant even on a slow connection.
      setDay((d) =>
        d
          ? {
              ...d,
              blocks: d.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
            }
          : d,
      );
      dayStore().patchBlock(id, patch).catch(fail);
    },
    [fail],
  );

  const reorderFlow = useCallback(
    (ids: string[]) => {
      const rank = new Map(ids.map((id, i) => [id, i + 1] as const));
      setDay((d) =>
        d
          ? {
              ...d,
              blocks: d.blocks.map((b) =>
                rank.has(b.id) ? { ...b, sortOrder: rank.get(b.id)! } : b,
              ),
            }
          : d,
      );
      dayStore().reorderFlow(ids).catch(fail);
    },
    [fail],
  );

  const carryTo = useCallback(
    (block: Block, toDay: string) => {
      // The copy lands first. Marking the original carried before its
      // replacement exists is how a block gets lost on a failed write.
      dayStore()
        .addBlock(carriedCopy(block), toDay)
        .then(() => {
          setDay((d) =>
            d
              ? {
                  ...d,
                  blocks: d.blocks.map((b) =>
                    b.id === block.id ? { ...b, status: "carried" } : b,
                  ),
                }
              : d,
          );
          return dayStore().patchBlock(block.id, { status: "carried" });
        })
        .catch(fail);
    },
    [fail],
  );

  const deleteBlock = useCallback(
    (id: string) => {
      setDay((d) =>
        d ? { ...d, blocks: d.blocks.filter((b) => b.id !== id) } : d,
      );
      dayStore().deleteBlock(id).catch(fail);
    },
    [fail],
  );

  const patchThread = useCallback(
    (id: string, patch: Partial<Omit<Thread, "id">>) => {
      setDay((d) =>
        d
          ? {
              ...d,
              threads: d.threads.map((t) =>
                t.id === id ? { ...t, ...patch } : t,
              ),
            }
          : d,
      );
      dayStore().patchThread(id, patch).catch(fail);
    },
    [fail],
  );

  const archiveThread = useCallback(
    (id: string) => {
      setDay((d) =>
        d
          ? {
              ...d,
              threads: d.threads.filter((t) => t.id !== id),
              // Blocks keep their history; they just lose the thread.
              blocks: d.blocks.map((b) =>
                b.threadId === id ? { ...b, threadId: null } : b,
              ),
            }
          : d,
      );
      dayStore().archiveThread(id).catch(fail);
    },
    [fail],
  );

  const addThreadNamed = useCallback(
    (name: string) => {
      return dayStore()
        .addThread(name)
        .then((thread) => {
          setDay((d) => (d ? { ...d, threads: [...d.threads, thread] } : d));
          return thread;
        })
        .catch((e: unknown) => {
          fail(e);
          // Rethrown so nothing downstream selects a goal that was never made.
          throw e;
        });
    },
    [fail],
  );

  const confirmDay = useCallback(() => {
    setDay((d) => (d ? { ...d, confirmed: true } : d));
    dayStore().confirmDay(date).catch(fail);
  }, [date, fail]);

  const addBlockWithThread = useCallback(
    (block: NewBlock, threadName: string | null) => {
      if (!threadName) {
        addBlock(block);
        return;
      }

      const needle = threadName.toLowerCase();
      const existing =
        day?.threads.find((t) => t.name.toLowerCase() === needle) ??
        day?.threads.find((t) => t.name.toLowerCase().startsWith(needle));

      if (existing) {
        addBlock({ ...block, threadId: existing.id });
        return;
      }

      const store = dayStore();
      store
        .addThread(threadName)
        .then((thread) => {
          setDay((d) => (d ? { ...d, threads: [...d.threads, thread] } : d));
          return store.addBlock({ ...block, threadId: thread.id }, date);
        })
        .then((created) => {
          setDay((d) => (d ? { ...d, blocks: [...d.blocks, created] } : d));
        })
        .catch(fail);
    },
    [day?.threads, addBlock, date, fail],
  );

  const saveRoutine = useCallback(
    (input: RoutineInput, id?: string) => {
      return dayStore()
        .saveRoutine(input, id)
        .then((routine) => {
          setRoutines((list) =>
            id
              ? list.map((r) => (r.id === id ? routine : r))
              : [...list, routine],
          );
          return routine;
        })
        .catch((e: unknown) => {
          fail(e);
          throw e;
        });
    },
    [fail],
  );

  const deleteRoutine = useCallback(
    (id: string) => {
      setRoutines((list) => list.filter((r) => r.id !== id));
      setDay((d) =>
        d
          ? {
              ...d,
              blocks: d.blocks.map((b) =>
                b.routineId === id ? { ...b, routineId: null } : b,
              ),
            }
          : d,
      );
      dayStore().deleteRoutine(id).catch(fail);
    },
    [fail],
  );

  return {
    day,
    routines,
    loading: day === null && error === null,
    error,
    addBlock,
    addBlocks,
    patchBlock,
    reorderFlow,
    carryTo,
    confirmDay,
    deleteBlock,
    patchThread,
    archiveThread,
    addThreadNamed,
    addBlockWithThread,
    saveRoutine,
    deleteRoutine,
  };
}
