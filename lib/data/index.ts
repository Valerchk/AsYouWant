import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createLocalDayStore, createLocalNoteStore } from "./localStore";
import { createRemoteDayStore, createRemoteNoteStore } from "./remoteStore";
import type { DayStore, NoteStore } from "./types";

/**
 * Which store the app is running on.
 *
 * Supabase takes over as soon as its keys are present — unless
 * NEXT_PUBLIC_LOCAL_ONLY is explicitly set, which keeps the browser store in
 * use while there is no database yet. Removing that flag is the single switch
 * that moves the whole app onto the database.
 */
export function usingDatabase(): boolean {
  return hasSupabaseEnv() && process.env.NEXT_PUBLIC_LOCAL_ONLY !== "1";
}

let day: DayStore | null = null;
let notes: NoteStore | null = null;

export function dayStore(): DayStore {
  day ??= usingDatabase() ? createRemoteDayStore() : createLocalDayStore();
  return day;
}

export function noteStore(): NoteStore {
  notes ??= usingDatabase() ? createRemoteNoteStore() : createLocalNoteStore();
  return notes;
}

export type { DayData, NewBlock, NoteData } from "./types";
