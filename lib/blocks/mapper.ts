import type { Block } from "@/lib/timeline/engine";
import type { Thread } from "@/lib/threads";
import type { Routine } from "@/lib/routines";
import type { Database } from "@/lib/supabase/types";

type BlockRow = Database["public"]["Tables"]["blocks"]["Row"];
type ThreadRow = Database["public"]["Tables"]["threads"]["Row"];
type RoutineRow = Database["public"]["Tables"]["routines"]["Row"];

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
    routineId: row.routine_id,
    colorIndex: row.color_index,
    icon: row.icon,
  };
}

export function toRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    startMin: row.start_min,
    plannedMin: row.planned_min,
    threadId: row.thread_id,
    repeatMask: row.repeat_mask,
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
