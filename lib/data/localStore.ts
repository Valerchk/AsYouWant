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
import type {
  DayData,
  DayStore,
  DayTemplate,
  NewBlock,
  NoteStore,
} from "./types";

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

const TEMPLATE_KEY = "ayw.templates.v1";

function readTemplates(): DayTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as DayTemplate[]) : [];
  } catch {
    return [];
  }
}

function writeTemplates(list: DayTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list));
  } catch {
    /* private mode or full quota; losing persistence is survivable */
  }
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

    async archiveThread(id) {
      const state = current ?? loadDay(at);
      persist({
        ...state,
        threads: state.threads.filter((t) => t.id !== id),
        // Blocks keep their history; they simply lose the thread.
        blocks: state.blocks.map((b) =>
          b.threadId === id ? { ...b, threadId: null } : b,
        ),
      });
    },

    async listTemplates() {
      return readTemplates();
    },

    async saveTemplate(name, blocks) {
      const template: DayTemplate = { id: newId(), name, blocks };
      // Saving under an existing name replaces it rather than making a twin.
      const rest = readTemplates().filter(
        (t) => t.name.toLowerCase() !== name.toLowerCase(),
      );
      writeTemplates([...rest, template]);
      return template;
    },

    async deleteTemplate(id) {
      writeTemplates(readTemplates().filter((t) => t.id !== id));
    },

    async loadWeek() {
      // Browser storage only ever holds today, so the week is today. The
      // Supabase store answers this properly.
      const state = current ?? loadDay(at);
      const totals = new Map<string, number>();
      for (const b of state.blocks) {
        if (!b.threadId || b.status !== "done") continue;
        const spent =
          b.actualEndMin !== null && b.actualStartMin !== null
            ? b.actualEndMin - b.actualStartMin
            : b.plannedMin;
        totals.set(b.threadId, (totals.get(b.threadId) ?? 0) + spent);
      }
      return totals;
    },
  };
}

export function createLocalNoteStore(): NoteStore {
  return {
    async load() {
      // Older stored notes predate the field; treat them as someday.
      return loadNotes().map((n) => ({ ...n, plannedFor: n.plannedFor ?? null }));
    },
    async add(text, plannedFor) {
      const note = makeNote(text, plannedFor);
      saveNotes([note, ...loadNotes()]);
      return note;
    },
    async remove(id) {
      saveNotes(loadNotes().filter((n) => n.id !== id));
    },
    async setPlannedFor(id, day) {
      saveNotes(
        loadNotes().map((n) => (n.id === id ? { ...n, plannedFor: day } : n)),
      );
    },
  };
}
