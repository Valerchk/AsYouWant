import type { Block } from "@/lib/timeline/engine";
import { THREAD_COLOR_COUNT, type Thread } from "@/lib/threads";
import {
  dayWindow,
  loadDay,
  newId,
  saveDay,
  type DayState,
} from "@/lib/store/local";
import {
  loadNotes,
  makeNote,
  saveNotes,
} from "@/lib/store/notes";
import type { DayData, DayStore, NewBlock, NoteStore } from "./types";

/* Browser-storage implementation. Used until Supabase is configured, so the
   app is usable — and judgeable — before there is a database.

   Everything is wrapped in promises to match the remote store's shape; the
   work itself is synchronous. */

function toDayData(state: DayState, nowMin: number): DayData {
  const bounds = dayWindow(nowMin);
  return {
    date: state.date,
    blocks: state.blocks,
    threads: state.threads,
    confirmed: state.confirmed,
    dayStartMin: bounds.start,
    dayEndMin: bounds.end,
  };
}

export function createLocalDayStore(): DayStore {
  let current: DayState | null = null;
  let at = 0;

  const persist = (next: DayState) => {
    current = next;
    saveDay(next);
  };

  return {
    async load(nowMin) {
      at = nowMin;
      current = loadDay(nowMin);
      return toDayData(current, nowMin);
    },

    async addBlock(block: NewBlock) {
      const state = current ?? loadDay(at);
      const created: Block = {
        ...block,
        id: newId(),
        sortOrder: state.blocks.length + 1,
      };
      persist({ ...state, blocks: [...state.blocks, created] });
      return created;
    },

    async patchBlock(id, patch) {
      const state = current ?? loadDay(at);
      persist({
        ...state,
        blocks: state.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      });
    },

    async confirmDay() {
      const state = current ?? loadDay(at);
      persist({ ...state, confirmed: true });
    },

    async addThread(name) {
      const state = current ?? loadDay(at);
      const thread: Thread = {
        id: newId(),
        name,
        // Walk the palette so consecutive goals never share a colour.
        colorIndex: state.threads.length % THREAD_COLOR_COUNT,
      };
      persist({ ...state, threads: [...state.threads, thread] });
      return thread;
    },

    async patchThread(id, patch) {
      const state = current ?? loadDay(at);
      persist({
        ...state,
        threads: state.threads.map((t) =>
          t.id === id ? { ...t, ...patch } : t,
        ),
      });
    },

    async deleteBlock(id) {
      const state = current ?? loadDay(at);
      persist({ ...state, blocks: state.blocks.filter((b) => b.id !== id) });
    },
  };
}

export function createLocalNoteStore(): NoteStore {
  return {
    async load() {
      return loadNotes();
    },
    async add(text) {
      const note = makeNote(text);
      saveNotes([note, ...loadNotes()]);
      return note;
    },
    async remove(id) {
      saveNotes(loadNotes().filter((n) => n.id !== id));
    },
  };
}
