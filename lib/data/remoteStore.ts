import { createClient } from "@/lib/supabase/client";
import { toBlock, toThread } from "@/lib/blocks/mapper";
import { dateInZone } from "@/lib/time";
import { THREAD_COLOR_COUNT } from "@/lib/threads";
import type { Block } from "@/lib/timeline/engine";
import type { Database } from "@/lib/supabase/types";
import type {
  DayData,
  DayStore,
  DayTemplate,
  NewBlock,
  NoteData,
  NoteStore,
  TemplateBlock,
} from "./types";

type BlockUpdate = Database["public"]["Tables"]["blocks"]["Update"];

/* Supabase implementation. Row level security scopes every query to the
   signed-in user, so no filter here is load-bearing for privacy — but the
   explicit user_id on writes is still required, because the column is NOT
   NULL and the policy checks it. */

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
function toRow(block: NewBlock, userId: string, day: string, sortOrder: number) {
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
  };
}

export function createRemoteDayStore(): DayStore {
  let userId = "";
  let today = "";
  let blockCount = 0;

  return {
    async load(): Promise<DayData> {
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
      const timezone = profile?.timezone ?? browserZone;
      today = dateInZone(new Date(), timezone);

      // The column defaults to UTC, which would put "today" and every
      // reminder on the wrong clock for anyone who is not in it. Adopt the
      // device's zone the first time we see it, and follow the person if they
      // move — the scheduler reads this column to decide when to speak.
      if (browserZone && profile && profile.timezone !== browserZone) {
        void supabase
          .from("profiles")
          .update({ timezone: browserZone })
          .eq("id", uid);
        today = dateInZone(new Date(), browserZone);
      }

      const [blocksRes, threadsRes] = await Promise.all([
        supabase.from("blocks").select("*").eq("user_id", uid).eq("day", today),
        supabase
          .from("threads")
          .select("*")
          .eq("user_id", uid)
          .is("archived_at", null)
          .order("sort_order"),
      ]);

      if (blocksRes.error) throw new Error(blocksRes.error.message);
      if (threadsRes.error) throw new Error(threadsRes.error.message);

      const blocks = (blocksRes.data ?? []).map(toBlock);
      blockCount = blocks.length;

      return {
        date: today,
        blocks,
        threads: (threadsRes.data ?? []).map(toThread),
        confirmed: profile?.day_confirmed_on === today,
        dayStartMin: profile?.day_start_min ?? 8 * 60,
        dayEndMin: profile?.day_end_min ?? 22 * 60,
      };
    },

    async addBlock(block: NewBlock): Promise<Block> {
      const supabase = createClient();
      blockCount += 1;
      const { data, error } = await supabase
        .from("blocks")
        .insert(toRow(block, userId, today, blockCount))
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
      if (patch.actualStartMin !== undefined) {
        row.actual_start_min = patch.actualStartMin;
      }
      if (patch.actualEndMin !== undefined) {
        row.actual_end_min = patch.actualEndMin;
      }

      const { error } = await supabase.from("blocks").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async confirmDay() {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ day_confirmed_on: today })
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

    async loadWeek() {
      const supabase = createClient();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      const fromDay = from.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("blocks")
        .select("thread_id, planned_min, actual_start_min, actual_end_min, status")
        .eq("user_id", userId)
        .gte("day", fromDay);

      if (error) throw new Error(error.message);

      const totals = new Map<string, number>();
      for (const row of data ?? []) {
        if (!row.thread_id || row.status !== "done") continue;
        // What it actually took, falling back to what was planned.
        const spent =
          row.actual_end_min !== null && row.actual_start_min !== null
            ? row.actual_end_min - row.actual_start_min
            : row.planned_min;
        totals.set(row.thread_id, (totals.get(row.thread_id) ?? 0) + spent);
      }
      return totals;
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
  };
}
