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
  /** The inbox could not be read at all. */
  error: string | null;
  /** A write failed; the list on screen is still good. See useDay. */
  problem: string | null;
  clearProblem: () => void;
  add: (text: string, plannedFor: string | null) => void;
  remove: (id: string) => void;
  setPlannedFor: (id: string, day: string | null) => void;
  setText: (id: string, text: string) => void;
  setDone: (id: string, done: boolean) => void;
}

export function useNotes(): UseNotes {
  const [notes, setNotes] = useState<NoteData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const warn = useCallback((e: unknown) => {
    setProblem(e instanceof Error ? e.message : String(e));
  }, []);

  const clearProblem = useCallback(() => setProblem(null), []);

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
      .catch(warn);
  }, [warn]);

  const remove = useCallback((id: string) => {
    setNotes((n) => (n ?? []).filter((x) => x.id !== id));
    announce();
    noteStore()
      .remove(id)
      .catch(warn);
  }, [warn]);

  const setPlannedFor = useCallback((id: string, day: string | null) => {
    setNotes((n) =>
      (n ?? []).map((x) => (x.id === id ? { ...x, plannedFor: day } : x)),
    );
    announce();
    noteStore()
      .setPlannedFor(id, day)
      .catch(warn);
  }, [warn]);

  const setText = useCallback((id: string, text: string) => {
    setNotes((n) => (n ?? []).map((x) => (x.id === id ? { ...x, text } : x)));
    noteStore()
      .setText(id, text)
      .catch(warn);
  }, [warn]);

  const setDone = useCallback((id: string, done: boolean) => {
    setNotes((n) =>
      (n ?? []).map((x) =>
        x.id === id ? { ...x, doneAt: done ? Date.now() : null } : x,
      ),
    );
    announce();
    noteStore()
      .setDone(id, done)
      .catch(warn);
  }, [warn]);

  return {
    notes: notes ?? [],
    loading: notes === null && error === null,
    error,
    problem,
    clearProblem,
    add,
    remove,
    setPlannedFor,
    setText,
    setDone,
  };
}
