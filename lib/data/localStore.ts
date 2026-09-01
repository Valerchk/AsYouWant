import type { Block } from "@/lib/timeline/engine";
import { THREAD_COLOR_COUNT, type Thread } from "@/lib/threads";
import { repeatsOnDay, type Routine, type RoutineInput } from "@/lib/routines";
import { addDays, daysBetween, localDay } from "@/lib/time";
import {
  dayWindow,
  loadVault,
  newId,
  saveVault,
  type StoredDay,
  type Vault,
} from "@/lib/store/local";
import { loadNotes, makeNote, saveNotes } from "@/lib/store/notes";
import type {
  DayStore,
  DayTemplate,
  ExportBundle,
  NewBlock,
  NoteStore,
  WeekSpend,
} from "./types";

/* Browser-storage implementation. Used until Supabase is configured, so the
   app is usable — and judgeable — before there is a database.

   Everything is wrapped in promises to match the remote store's shape; the
   work itself is synchronous. */

const EMPTY_DAY: StoredDay = { blocks: [], confirmed: false };

/** Minutes a finished block actually took, falling back to what was planned. */
function spentOn(block: Block): number {
  return block.actualEndMin !== null && block.actualStartMin !== null
    ? block.actualEndMin - block.actualStartMin
    : block.plannedMin;
}

/**
 * Grow whatever routines belong on this day and have not grown yet.
 *
 * Only ever forward from today. Backfilling history would invent a gym
 * session you never went to and then count it in the week's totals.
 */
function materialise(vault: Vault, day: string): boolean {
  if (daysBetween(localDay(), day) < 0) return false;

  const stored = vault.days[day] ?? { blocks: [], confirmed: false };
  const blocks = [...stored.blocks];
  let grew = false;

  for (const routine of vault.routines) {
    if (!repeatsOnDay(routine.repeatMask, day)) continue;
    if (blocks.some((b) => b.routineId === routine.id)) continue;

    blocks.push({
      id: newId(),
      title: routine.title,
      kind: routine.kind,
      startMin: routine.startMin,
      plannedMin: routine.plannedMin,
      status: "planned",
      sortOrder: blocks.length + 1,
      threadId: routine.threadId,
      actualStartMin: null,
      actualEndMin: null,
      routineId: routine.id,
    });
    grew = true;
  }

  if (grew) vault.days[day] = { ...stored, blocks };
  return grew;
}

export function createLocalDayStore(): DayStore {
  let at = 0;

  const read = (): Vault => loadVault(at);

  /** Find and update the day a block lives on, wherever that is. */
  function editBlock(
    change: (blocks: Block[]) => Block[],
    where: (blocks: Block[]) => boolean,
  ): void {
    const vault = read();
    for (const [day, stored] of Object.entries(vault.days)) {
      if (!where(stored.blocks)) continue;
      vault.days[day] = { ...stored, blocks: change(stored.blocks) };
    }
    saveVault(vault);
  }

  return {
    async load(day, nowMin) {
      at = nowMin;
      const vault = read();
      if (materialise(vault, day)) saveVault(vault);

      const stored = vault.days[day] ?? EMPTY_DAY;
      const bounds = dayWindow(nowMin);
      return {
        date: day,
        blocks: stored.blocks,
        threads: vault.threads,
        confirmed: stored.confirmed,
        dayStartMin: bounds.start,
        dayEndMin: bounds.end,
      };
    },

    async addBlock(block: NewBlock, day: string) {
      const vault = read();
      const stored = vault.days[day] ?? EMPTY_DAY;
      const created: Block = {
        ...block,
        id: newId(),
        sortOrder: stored.blocks.length + 1,
      };
      vault.days[day] = { ...stored, blocks: [...stored.blocks, created] };
      saveVault(vault);
      return created;
    },

    async patchBlock(id, patch) {
      editBlock(
        (blocks) => blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        (blocks) => blocks.some((b) => b.id === id),
      );
    },

    async reorderFlow(ids) {
      const rank = new Map(ids.map((id, i) => [id, i + 1] as const));
      editBlock(
        (blocks) =>
          blocks.map((b) =>
            rank.has(b.id) ? { ...b, sortOrder: rank.get(b.id)! } : b,
          ),
        (blocks) => blocks.some((b) => rank.has(b.id)),
      );
    },

    async deleteBlock(id) {
      editBlock(
        (blocks) => blocks.filter((b) => b.id !== id),
        (blocks) => blocks.some((b) => b.id === id),
      );
    },

    async confirmDay(day) {
      const vault = read();
      const stored = vault.days[day] ?? EMPTY_DAY;
      vault.days[day] = { ...stored, confirmed: true };
      saveVault(vault);
    },

    async addThread(name) {
      const vault = read();
      const thread: Thread = {
        id: newId(),
        name,
        // Walk the palette so consecutive goals never share a colour.
        colorIndex: vault.threads.length % THREAD_COLOR_COUNT,
      };
      vault.threads = [...vault.threads, thread];
      saveVault(vault);
      return thread;
    },

    async patchThread(id, patch) {
      const vault = read();
      vault.threads = vault.threads.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      );
      saveVault(vault);
    },

    async archiveThread(id) {
      const vault = read();
      vault.threads = vault.threads.filter((t) => t.id !== id);
      // Blocks keep their history; they simply lose the thread.
      for (const [day, stored] of Object.entries(vault.days)) {
        vault.days[day] = {
          ...stored,
          blocks: stored.blocks.map((b) =>
            b.threadId === id ? { ...b, threadId: null } : b,
          ),
        };
      }
      vault.routines = vault.routines.map((r) =>
        r.threadId === id ? { ...r, threadId: null } : r,
      );
      saveVault(vault);
    },

    async loadWeek(endDay) {
      const vault = read();
      const totals = new Map<string, number>();
      const days: WeekSpend["days"] = [];

      for (let i = 6; i >= 0; i -= 1) {
        const date = addDays(endDay, -i);
        const byThread = new Map<string, number>();
        for (const b of vault.days[date]?.blocks ?? []) {
          if (!b.threadId || b.status !== "done") continue;
          const spent = spentOn(b);
          byThread.set(b.threadId, (byThread.get(b.threadId) ?? 0) + spent);
          totals.set(b.threadId, (totals.get(b.threadId) ?? 0) + spent);
        }
        days.push({ date, byThread });
      }

      return { totals, days };
    },

    async loadCounts(fromDay, toDay) {
      const vault = read();
      const counts = new Map<string, number>();
      const span = daysBetween(fromDay, toDay);
      for (let i = 0; i <= span; i += 1) {
        const date = addDays(fromDay, i);
        const live = (vault.days[date]?.blocks ?? []).filter(
          (b) => b.status !== "dropped" && b.status !== "carried",
        );
        if (live.length > 0) counts.set(date, live.length);
      }
      return counts;
    },

    async listRoutines() {
      return read().routines;
    },

    async saveRoutine(input: RoutineInput, id?: string) {
      const vault = read();
      const routine: Routine = { ...input, id: id ?? newId() };
      vault.routines = id
        ? vault.routines.map((r) => (r.id === id ? routine : r))
        : [...vault.routines, routine];
      saveVault(vault);
      return routine;
    },

    async deleteRoutine(id) {
      const vault = read();
      vault.routines = vault.routines.filter((r) => r.id !== id);
      // The blocks it already grew stay; they are days that happened.
      for (const [day, stored] of Object.entries(vault.days)) {
        vault.days[day] = {
          ...stored,
          blocks: stored.blocks.map((b) =>
            b.routineId === id ? { ...b, routineId: null } : b,
          ),
        };
      }
      saveVault(vault);
    },

    async listTemplates() {
      return read().templates;
    },

    async saveTemplate(name, blocks) {
      const vault = read();
      const template: DayTemplate = { id: newId(), name, blocks };
      // Saving under an existing name replaces it rather than making a twin.
      vault.templates = [
        ...vault.templates.filter(
          (t) => t.name.toLowerCase() !== name.toLowerCase(),
        ),
        template,
      ];
      saveVault(vault);
      return template;
    },

    async deleteTemplate(id) {
      const vault = read();
      vault.templates = vault.templates.filter((t) => t.id !== id);
      saveVault(vault);
    },

    async exportAll(): Promise<ExportBundle> {
      const vault = read();
      return {
        exportedAt: new Date().toISOString(),
        threads: vault.threads,
        routines: vault.routines,
        templates: vault.templates,
        notes: loadNotes().map((n) => ({
          ...n,
          plannedFor: n.plannedFor ?? null,
          doneAt: n.doneAt ?? null,
        })),
        days: Object.entries(vault.days)
          .map(([date, stored]) => ({ date, blocks: stored.blocks }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    },
  };
}

export function createLocalNoteStore(): NoteStore {
  return {
    async load() {
      // Older stored notes predate the field; treat them as someday.
      return loadNotes().map((n) => ({
        ...n,
        plannedFor: n.plannedFor ?? null,
        doneAt: n.doneAt ?? null,
      }));
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
    async setText(id, text) {
      saveNotes(
        loadNotes().map((n) => (n.id === id ? { ...n, text } : n)),
      );
    },
    async setDone(id, done) {
      saveNotes(
        loadNotes().map((n) =>
          n.id === id ? { ...n, doneAt: done ? Date.now() : null } : n,
        ),
      );
    },
  };
}
