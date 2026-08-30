"use client";

import { useCallback, useEffect, useState } from "react";
import { noteStore } from "./index";
import type { NoteData } from "./types";

const CHANGED = "ayw:notes";

/** Lets the tab badge follow the inbox from either screen. */
function announce() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
}

export interface UseNotes {
  notes: NoteData[];
  loading: boolean;
  error: string | null;
  add: (text: string) => void;
  remove: (id: string) => void;
}

export function useNotes(): UseNotes {
  const [notes, setNotes] = useState<NoteData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    noteStore()
      .load()
      .then((n) => {
        if (alive) setNotes(n);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  const add = useCallback((text: string) => {
    noteStore()
      .add(text)
      .then((note) => {
        setNotes((n) => [note, ...(n ?? [])]);
        announce();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  const remove = useCallback((id: string) => {
    setNotes((n) => (n ?? []).filter((x) => x.id !== id));
    announce();
    noteStore()
      .remove(id)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  return {
    notes: notes ?? [],
    loading: notes === null && error === null,
    error,
    add,
    remove,
  };
}
