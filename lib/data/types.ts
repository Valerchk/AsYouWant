import type { Block } from "@/lib/timeline/engine";
import type { Thread } from "@/lib/threads";

/* One shape for the day, whichever store it came from. Screens depend on
   this and never on Supabase or localStorage directly, so connecting the
   database changes lib/data and nothing above it. */

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

export interface DayStore {
  load(nowMin: number): Promise<DayData>;
  addBlock(block: NewBlock): Promise<Block>;
  patchBlock(id: string, patch: Partial<Block>): Promise<void>;
  confirmDay(): Promise<void>;
  /** Create a goal on demand, when someone types a #tag that has no thread. */
  addThread(name: string): Promise<Thread>;
  patchThread(id: string, patch: Partial<Omit<Thread, "id">>): Promise<void>;
  /** Retire a goal without touching the blocks that already reference it. */
  archiveThread(id: string): Promise<void>;
  deleteBlock(id: string): Promise<void>;
  /** Minutes spent per thread over the last seven days, keyed by thread id. */
  loadWeek(): Promise<Map<string, number>>;

  listTemplates(): Promise<DayTemplate[]>;
  /** Store today's shape under a name. Replaces one of the same name. */
  saveTemplate(name: string, blocks: TemplateBlock[]): Promise<DayTemplate>;
  deleteTemplate(id: string): Promise<void>;
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

export interface NoteData {
  id: string;
  text: string;
  createdAt: number;
}

export interface NoteStore {
  load(): Promise<NoteData[]>;
  add(text: string): Promise<NoteData>;
  remove(id: string): Promise<void>;
}
