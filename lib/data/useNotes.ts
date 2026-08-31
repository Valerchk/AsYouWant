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
  add: (text: string, plannedFor: string | null) => void;
  remove: (id: string) => void;
  setPlannedFor: (id: string, day: string | null) => void;
  setText: (id: string, text: string) => void;
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

  const add = useCallback((text: string, plannedFor: string | null) => {
    noteStore()
      .add(text, plannedFor)
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

  const setPlannedFor = useCallback((id: string, day: string | null) => {
    setNotes((n) =>
      (n ?? []).map((x) => (x.id === id ? { ...x, plannedFor: day } : x)),
    );
    announce();
    noteStore()
      .setPlannedFor(id, day)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  const setText = useCallback((id: string, text: string) => {
    setNotes((n) => (n ?? []).map((x) => (x.id === id ? { ...x, text } : x)));
    noteStore()
      .setText(id, text)
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
    setPlannedFor,
    setText,
  };
}
