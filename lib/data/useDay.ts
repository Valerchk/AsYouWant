"use client";

import { useCallback, useEffect, useState } from "react";
import type { Block } from "@/lib/timeline/engine";
import type { Thread } from "@/lib/threads";
import { dayStore } from "./index";
import type { DayData, NewBlock } from "./types";

/* The day, from whichever store is configured. Screens use this and never
   touch Supabase or localStorage themselves, so connecting the database is a
   change to lib/data alone. */

export interface UseDay {
  day: DayData | null;
  loading: boolean;
  error: string | null;
  addBlock: (block: NewBlock) => void;
  patchBlock: (id: string, patch: Partial<Block>) => void;
  confirmDay: () => void;
  deleteBlock: (id: string) => void;
  patchThread: (id: string, patch: Partial<Omit<Thread, "id">>) => void;
  /**
   * Add a block, creating its goal first if the #tag names one that does not
   * exist yet. Without this, a fresh account — which has no threads at all —
   * would silently drop every tag someone typed.
   */
  addBlockWithThread: (block: NewBlock, threadName: string | null) => void;
}

export function useDay(nowMin: number): UseDay {
  // Pinned at mount: the clock ticks every minute, and the day must not
  // reload underneath the person each time it does.
  const [initialNow] = useState(nowMin);
  const [day, setDay] = useState<DayData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    dayStore()
      .load(initialNow)
      .then((d) => {
        if (alive) setDay(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [initialNow]);

  const addBlock = useCallback((block: NewBlock) => {
    dayStore()
      .addBlock(block)
      .then((created) => {
        setDay((d) => (d ? { ...d, blocks: [...d.blocks, created] } : d));
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  const patchBlock = useCallback((id: string, patch: Partial<Block>) => {
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
    dayStore()
      .patchBlock(id, patch)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setDay((d) =>
      d ? { ...d, blocks: d.blocks.filter((b) => b.id !== id) } : d,
    );
    dayStore()
      .deleteBlock(id)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

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
      dayStore()
        .patchThread(id, patch)
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : String(e));
        });
    },
    [],
  );

  const confirmDay = useCallback(() => {
    setDay((d) => (d ? { ...d, confirmed: true } : d));
    dayStore()
      .confirmDay()
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  const addBlockWithThread = useCallback(
    (block: NewBlock, threadName: string | null) => {
      const fail = (e: unknown) =>
        setError(e instanceof Error ? e.message : String(e));

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
          return store.addBlock({ ...block, threadId: thread.id });
        })
        .then((created) => {
          setDay((d) => (d ? { ...d, blocks: [...d.blocks, created] } : d));
        })
        .catch(fail);
    },
    [day?.threads, addBlock],
  );

  return {
    day,
    loading: day === null && error === null,
    error,
    addBlock,
    patchBlock,
    confirmDay,
    deleteBlock,
    patchThread,
    addBlockWithThread,
  };
}
