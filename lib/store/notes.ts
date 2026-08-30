/* The inbox: somewhere to put a thought without deciding when to do it.

   Kept apart from the day because notes outlive it — a thought caught on
   Tuesday is still there on Friday, whereas the day's blocks reset. Same
   temporary-local-storage shape as lib/store/local.ts, and it will move to
   Supabase alongside it. */

import { newId } from "./local";

const KEY = "ayw.notes.v1";

export interface Note {
  id: string;
  text: string;
  /** Epoch ms, for ordering newest-first. */
  createdAt: number;
}

export function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Note[]) : [];
  } catch {
    // Corrupt or unreadable storage must never stop the screen from opening.
    return [];
  }
}

export function saveNotes(notes: Note[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    // Private mode, or the quota is full. Losing persistence is survivable.
  }
}

export function makeNote(text: string): Note {
  return { id: newId(), text: text.trim(), createdAt: Date.now() };
}

/** "2 min ago", "3 h ago", "Tue" — short enough to sit beside the text. */
export function relativeTime(createdAt: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - createdAt) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
