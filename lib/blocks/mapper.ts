import type { Block } from "@/lib/timeline/engine";
import type { Thread } from "@/lib/threads";
import type { Database } from "@/lib/supabase/types";

type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];
type ThreadRow = Database["public"]["Tables"]["threads"]["Row"];

/* The database speaks snake_case and the engine speaks camelCase. Converting
   in one place keeps every column name out of the domain logic. */

export function toBlock(row: BlockRow): Block {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    startMin: row.start_min,
    plannedMin: row.planned_min,
    status: row.status,
    sortOrder: row.sort_order,
    threadId: row.thread_id,
    actualStartMin: row.actual_start_min,
    actualEndMin: row.actual_end_min,
  };
}

export function toThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    name: row.name,
    colorIndex: row.color_index,
    weeklyTargetMin: row.weekly_target_min,
    icon: row.icon,
  };
}
