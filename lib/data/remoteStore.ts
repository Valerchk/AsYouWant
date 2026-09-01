import { createClient } from "@/lib/supabase/client";
import { toBlock, toRoutine, toThread } from "@/lib/blocks/mapper";
import { addDays, dateInZone, daysBetween } from "@/lib/time";
import { repeatsOnDay, type RoutineInput } from "@/lib/routines";
import { THREAD_COLOR_COUNT } from "@/lib/threads";
import type { Block } from "@/lib/timeline/engine";
import type { Database } from "@/lib/supabase/types";
import type {
  DayData,
  DayStore,
  DayTemplate,
  ExportBundle,
  NewBlock,
  NoteData,
  NoteStore,
  Spend,
  TemplateBlock,
} from "./types";

type BlockUpdate = Database["public"]["Tables"]["blocks"]["Update"];
type BlockInsert = Database["public"]["Tables"]["blocks"]["Insert"];

/* Supabase implementation. Row level security scopes every query to the
   signed-in user, so no filter here is load-bearing for privacy — but the
   explicit user_id on writes is still required, because the column is NOT
   NULL and the policy checks it. */

/** Two tabs opening the same day both try to grow the same routine. */
const UNIQUE_VIOLATION = "23505";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not signed in.");
  return { supabase, userId: user.id };
}

/** Domain block → database columns. Only the fields a client may set. */
function toRow(
  block: NewBlock,
  userId: string,
  day: string,
  sortOrder: number,
): BlockInsert {
  return {
    user_id: userId,
    day,
    title: block.title,
    kind: block.kind,
    start_min: block.startMin,
    planned_min: block.plannedMin,
    status: block.status,
    thread_id: block.threadId,
    actual_start_min: block.actualStartMin,
    actual_end_min: block.actualEndMin,
    sort_order: sortOrder,
    routine_id: block.routineId ?? null,
    color_index: block.colorIndex ?? null,
    icon: block.icon ?? null,
  };
}

function spentOn(row: {
  planned_min: number;
  actual_start_min: number | null;
  actual_end_min: number | null;
}): number {
  return row.actual_end_min !== null && row.actual_start_min !== null
    ? row.actual_end_min - row.actual_start_min
    : row.planned_min;
}

export function createRemoteDayStore(): DayStore {
  let userId = "";
  let timezone = "UTC";

  /** Today where the person is, not where the server is. */
  const today = () => dateInZone(new Date(), timezone);

  return {
    async load(day: string, nowMin: number): Promise<DayData> {
      void nowMin;
      const { supabase, userId: uid } = await requireUser();
      userId = uid;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();

      // The trigger on auth.users creates this row; if it is somehow missing,
      // fall back to sane defaults rather than failing to open the app.
      const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      timezone = profile?.timezone ?? browserZone ?? "UTC";

      // The column defaults to UTC, which would put "today" and every
      // reminder on the wrong clock for anyone who is not in it. Adopt the
      // device's zone the first time we see it, and follow the person if they
      // move — the scheduler reads this column to decide when to speak.
      if (browserZone && profile && profile.timezone !== browserZone) {
        void supabase
          .from("profiles")
          .update({ timezone: browserZone })
          .eq("id", uid);
        timezone = browserZone;
      }

      const [blocksRes, threadsRes, routinesRes] = await Promise.all([
        supabase.from("blocks").select("*").eq("user_id", uid).eq("day", day),
        supabase
          .from("threads")
          .select("*")
          .eq("user_id", uid)
          .is("archived_at", null)
          .order("sort_order"),
        supabase.from("routines").select("*").eq("user_id", uid),
      ]);

      if (blocksRes.error) throw new Error(blocksRes.error.message);
      if (threadsRes.error) throw new Error(threadsRes.error.message);

      let blocks = (blocksRes.data ?? []).map(toBlock);

      /* Grow whatever routines belong on this day and have not grown yet.
         Only ever forward from today: backfilling history would invent a gym
         session you never went to and then count it in the week's totals. */
      const routines = (routinesRes.data ?? []).map(toRoutine);
      if (daysBetween(today(), day) >= 0) {
        const already = new Set(blocks.map((b) => b.routineId));
        const missing = routines.filter(
          (r) => repeatsOnDay(r.repeatMask, day) && !already.has(r.id),
        );

        if (missing.length > 0) {
          const rows = missing.map((r, i) =>
            toRow(
              {
                title: r.title,
                kind: r.kind,
                startMin: r.startMin,
                plannedMin: r.plannedMin,
                status: "planned",
                threadId: r.threadId,
                actualStartMin: null,
                actualEndMin: null,
                routineId: r.id,
              },
              uid,
              day,
              blocks.length + i + 1,
            ),
          );

          const grown = await supabase.from("blocks").insert(rows).select();
          if (grown.error && grown.error.code !== UNIQUE_VIOLATION) {
            throw new Error(grown.error.message);
          }
          if (grown.error) {
            // Another tab got there first. Its rows are the real ones.
            const again = await supabase
              .from("blocks")
              .select("*")
              .eq("user_id", uid)
              .eq("day", day);
            blocks = (again.data ?? []).map(toBlock);
          } else {
            blocks = [...blocks, ...(grown.data ?? []).map(toBlock)];
          }
        }
      }

      return {
        date: day,
        blocks,
        threads: (threadsRes.data ?? []).map(toThread),
        confirmed: profile?.day_confirmed_on === day,
        dayStartMin: profile?.day_start_min ?? 8 * 60,
        dayEndMin: profile?.day_end_min ?? 22 * 60,
      };
    },

    async addBlock(block: NewBlock, day: string): Promise<Block> {
      const supabase = createClient();
      // Counted per day rather than kept in a variable: the app can now be
      // adding to tomorrow while today is on screen.
      const { count } = await supabase
        .from("blocks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("day", day);

      const { data, error } = await supabase
        .from("blocks")
        .insert(toRow(block, userId, day, (count ?? 0) + 1))
        .select()
        .single();

      if (error) throw new Error(error.message);
      return toBlock(data);
    },

    async patchBlock(id, patch) {
      const supabase = createClient();
      // Only the columns a patch can legitimately touch, typed against the
      // table so a rename in the schema breaks the build rather than the app.
      const row: BlockUpdate = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.startMin !== undefined) row.start_min = patch.startMin;
      if (patch.plannedMin !== undefined) row.planned_min = patch.plannedMin;
      if (patch.kind !== undefined) row.kind = patch.kind;
      if (patch.threadId !== undefined) row.thread_id = patch.threadId;
      if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
      if (patch.routineId !== undefined) row.routine_id = patch.routineId;
      if (patch.colorIndex !== undefined) row.color_index = patch.colorIndex;
      if (patch.icon !== undefined) row.icon = patch.icon;
      if (patch.actualStartMin !== undefined) {
        row.actual_start_min = patch.actualStartMin;
      }
      if (patch.actualEndMin !== undefined) {
        row.actual_end_min = patch.actualEndMin;
      }

      const { error } = await supabase.from("blocks").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async reorderFlow(ids) {
      const supabase = createClient();
      const results = await Promise.all(
        ids.map((id, i) =>
          supabase.from("blocks").update({ sort_order: i + 1 }).eq("id", id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
    },

    async confirmDay(day) {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ day_confirmed_on: day })
        .eq("id", userId);
      if (error) throw new Error(error.message);
    },

    async addThread(name) {
      const supabase = createClient();
      // Walk the palette so consecutive goals never share a colour.
      const { count } = await supabase
        .from("threads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      const { data, error } = await supabase
        .from("threads")
        .insert({
          user_id: userId,
          name,
          color_index: (count ?? 0) % THREAD_COLOR_COUNT,
          sort_order: (count ?? 0) + 1,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return toThread(data);
    },

    async patchThread(id, patch) {
      const supabase = createClient();
      const row: {
        name?: string;
        color_index?: number;
        weekly_target_min?: number | null;
        icon?: string | null;
      } = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.colorIndex !== undefined) row.color_index = patch.colorIndex;
      if (patch.weeklyTargetMin !== undefined) {
        row.weekly_target_min = patch.weeklyTargetMin;
      }
      if (patch.icon !== undefined) row.icon = patch.icon;

      const { error } = await supabase.from("threads").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async deleteBlock(id) {
      const supabase = createClient();
      const { error } = await supabase.from("blocks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async archiveThread(id) {
      const supabase = createClient();
      // Archived rather than deleted: blocks reference it, and a finished day
      // should keep saying which goal it fed.
      const { error } = await supabase
        .from("threads")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },

    async loadSpend(fromDay, toDay): Promise<Spend> {
      const supabase = createClient();
      const endDay = toDay;

      const { data, error } = await supabase
        .from("blocks")
        .select("day, thread_id, planned_min, actual_start_min, actual_end_min, status")
        .eq("user_id", userId)
        .gte("day", fromDay)
        .lte("day", endDay);

      if (error) throw new Error(error.message);

      const totals = new Map<string, number>();
      const perDay = new Map<string, Map<string, number>>();

      for (const row of data ?? []) {
        if (!row.thread_id || row.status !== "done") continue;
        const spent = spentOn(row);
        totals.set(row.thread_id, (totals.get(row.thread_id) ?? 0) + spent);

        const bucket = perDay.get(row.day) ?? new Map<string, number>();
        bucket.set(row.thread_id, (bucket.get(row.thread_id) ?? 0) + spent);
        perDay.set(row.day, bucket);
      }

      return {
        totals,
        days: Array.from({ length: daysBetween(fromDay, endDay) + 1 }, (_, i) => {
          const date = addDays(fromDay, i);
          return { date, byThread: perDay.get(date) ?? new Map() };
        }),
      };
    },

    async loadCounts(fromDay, toDay) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("blocks")
        .select("day, status")
        .eq("user_id", userId)
        .gte("day", fromDay)
        .lte("day", toDay);

      if (error) throw new Error(error.message);

      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        if (row.status === "dropped" || row.status === "carried") continue;
        counts.set(row.day, (counts.get(row.day) ?? 0) + 1);
      }
      return counts;
    },

    async listRoutines() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("routines")
        .select("*")
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return (data ?? []).map(toRoutine);
    },

    async saveRoutine(input: RoutineInput, id?: string) {
      const supabase = createClient();
      const row = {
        user_id: userId,
        title: input.title,
        kind: input.kind,
        start_min: input.startMin,
        planned_min: input.plannedMin,
        thread_id: input.threadId,
        repeat_mask: input.repeatMask,
      };

      const query = id
        ? supabase.from("routines").update(row).eq("id", id).select().single()
        : supabase.from("routines").insert(row).select().single();

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return toRoutine(data);
    },

    async deleteRoutine(id) {
      const supabase = createClient();
      // The blocks it already grew keep their days; the foreign key is
      // ON DELETE SET NULL, so they simply stop belonging to a routine.
      const { error } = await supabase.from("routines").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async listTemplates(): Promise<DayTemplate[]> {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("day_templates")
        .select("*")
        .eq("user_id", userId)
        .order("name");

      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        blocks: Array.isArray(row.payload)
          ? (row.payload as TemplateBlock[])
          : [],
      }));
    },

    async saveTemplate(name, blocks): Promise<DayTemplate> {
      const supabase = createClient();
      // (user_id, name) is unique in the schema, so saving the same name
      // twice updates rather than failing.
      const { data, error } = await supabase
        .from("day_templates")
        .upsert(
          { user_id: userId, name, payload: blocks },
          { onConflict: "user_id,name" },
        )
        .select()
        .single();

      if (error) throw new Error(error.message);
      return { id: data.id, name: data.name, blocks };
    },

    async deleteTemplate(id) {
      const supabase = createClient();
      const { error } = await supabase
        .from("day_templates")
        .delete()
        .eq("id", id);
      if (error) throw new Error(error.message);
    },

    async exportAll(): Promise<ExportBundle> {
      const { supabase, userId: uid } = await requireUser();

      const [blocks, threads, routines, templates, notes] = await Promise.all([
        supabase.from("blocks").select("*").eq("user_id", uid).order("day"),
        supabase.from("threads").select("*").eq("user_id", uid),
        supabase.from("routines").select("*").eq("user_id", uid),
        supabase.from("day_templates").select("*").eq("user_id", uid),
        supabase.from("notes").select("*").eq("user_id", uid),
      ]);

      const byDay = new Map<string, Block[]>();
      for (const row of blocks.data ?? []) {
        const list = byDay.get(row.day) ?? [];
        list.push(toBlock(row));
        byDay.set(row.day, list);
      }

      return {
        exportedAt: new Date().toISOString(),
        threads: (threads.data ?? []).map(toThread),
        routines: (routines.data ?? []).map(toRoutine),
        templates: (templates.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          blocks: Array.isArray(row.payload)
            ? (row.payload as TemplateBlock[])
            : [],
        })),
        notes: (notes.data ?? []).map((r) => ({
          id: r.id,
          text: r.text,
          createdAt: new Date(r.created_at).getTime(),
          plannedFor: r.planned_for,
          doneAt: r.done_at ? new Date(r.done_at).getTime() : null,
        })),
        days: Array.from(byDay.entries())
          .map(([date, list]) => ({ date, blocks: list }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    },
  };
}

export function createRemoteNoteStore(): NoteStore {
  return {
    async load(): Promise<NoteData[]> {
      const { supabase, userId } = await requireUser();
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        id: r.id,
        text: r.text,
        createdAt: new Date(r.created_at).getTime(),
        plannedFor: r.planned_for,
        doneAt: r.done_at ? new Date(r.done_at).getTime() : null,
      }));
    },

    async add(text: string, plannedFor: string | null): Promise<NoteData> {
      const { supabase, userId } = await requireUser();
      const { data, error } = await supabase
        .from("notes")
        .insert({ user_id: userId, text: text.trim(), planned_for: plannedFor })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return {
        id: data.id,
        text: data.text,
        createdAt: new Date(data.created_at).getTime(),
        plannedFor: data.planned_for,
        doneAt: null,
      };
    },

    async remove(id: string) {
      const supabase = createClient();
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async setPlannedFor(id: string, day: string | null) {
      const supabase = createClient();
      const { error } = await supabase
        .from("notes")
        .update({ planned_for: day })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },

    async setText(id: string, text: string) {
      const supabase = createClient();
      const { error } = await supabase
        .from("notes")
        .update({ text: text.trim() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },

    async setDone(id: string, done: boolean) {
      const supabase = createClient();
      const { error } = await supabase
        .from("notes")
        .update({ done_at: done ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}
