import type { Block } from "@/lib/timeline/engine";
import type { Thread } from "@/lib/threads";
import type { Routine, RoutineInput } from "@/lib/routines";

/* One shape for a day, whichever store it came from. Screens depend on this
   and never on Supabase or localStorage directly, so connecting the database
   changes lib/data and nothing above it.

   Every method that touches a day takes the day explicitly. The store used to
   hold "today" as private state, which was the reason the app could only ever
   show one date — and the reason "push to tomorrow" had nowhere to push to. */

export interface DayData {
  /** YYYY-MM-DD in the user's own timezone. */
  date: string;
  blocks: Block[];
  threads: Thread[];
  /** True once the plan has been agreed to; reminders stay silent until then. */
  confirmed: boolean;
  dayStartMin: number;
  dayEndMin: number;
}

/** A block before the store has given it an id and a position. */
export type NewBlock = Omit<Block, "id" | "sortOrder">;

export interface WeekSpend {
  /** Minutes per goal across the whole week, keyed by goal id. */
  totals: Map<string, number>;
  /** Oldest day first, so a bar chart reads left to right. */
  days: { date: string; byThread: Map<string, number> }[];
}

export interface DayStore {
  load(day: string, nowMin: number): Promise<DayData>;
  addBlock(block: NewBlock, day: string): Promise<Block>;
  patchBlock(id: string, patch: Partial<Block>): Promise<void>;
  /** New order for flow blocks, first to last. */
  reorderFlow(ids: string[]): Promise<void>;
  confirmDay(day: string): Promise<void>;
  /** Create a goal on demand, when someone types a #tag that has no thread. */
  addThread(name: string): Promise<Thread>;
  patchThread(id: string, patch: Partial<Omit<Thread, "id">>): Promise<void>;
  /** Retire a goal without touching the blocks that already reference it. */
  archiveThread(id: string): Promise<void>;
  deleteBlock(id: string): Promise<void>;
  /** Seven days ending on `endDay`: totals per goal, and the daily breakdown. */
  loadWeek(endDay: string): Promise<WeekSpend>;
  /** How many blocks each day in the range holds. Drives the week strip. */
  loadCounts(fromDay: string, toDay: string): Promise<Map<string, number>>;

  listRoutines(): Promise<Routine[]>;
  /** Creates when `id` is absent, replaces when it is present. */
  saveRoutine(input: RoutineInput, id?: string): Promise<Routine>;
  deleteRoutine(id: string): Promise<void>;

  listTemplates(): Promise<DayTemplate[]>;
  /** Store a day's shape under a name. Replaces one of the same name. */
  saveTemplate(name: string, blocks: TemplateBlock[]): Promise<DayTemplate>;
  deleteTemplate(id: string): Promise<void>;

  /** Everything this account holds, as plain JSON. */
  exportAll(): Promise<ExportBundle>;
}

/** A saved shape of a day: blocks with times but no date. */
export interface DayTemplate {
  id: string;
  name: string;
  blocks: TemplateBlock[];
}

export interface TemplateBlock {
  title: string;
  kind: Block["kind"];
  startMin: number | null;
  plannedMin: number;
  threadId: string | null;
}

export interface ExportBundle {
  exportedAt: string;
  threads: Thread[];
  routines: Routine[];
  templates: DayTemplate[];
  notes: NoteData[];
  days: { date: string; blocks: Block[] }[];
}

export interface NoteData {
  id: string;
  text: string;
  createdAt: number;
  /** YYYY-MM-DD when this is an intention for a day; null means someday. */
  plannedFor: string | null;
}

export interface NoteStore {
  load(): Promise<NoteData[]>;
  add(text: string, plannedFor: string | null): Promise<NoteData>;
  remove(id: string): Promise<void>;
  /** Move between "today" and "someday". */
  setPlannedFor(id: string, day: string | null): Promise<void>;
  /** A thought is allowed to change its mind. */
  setText(id: string, text: string): Promise<void>;
}
