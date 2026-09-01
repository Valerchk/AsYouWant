/* Block state transitions. Pure, and deliberately not inline in the screen:
   getting the arithmetic wrong here produces a ribbon that looks broken
   rather than an error, which is exactly what happened once already. */

import type { Block } from "./engine";

/**
 * Close a block.
 *
 * `placedStartMin` is where the ribbon actually put it, which is not the same
 * as `block.startMin` for flow blocks.
 *
 * The three cases, and why:
 *
 * · Still ahead of now — closing it means "already handled", so it keeps its
 *   full planned length. Measuring "start until now" here would come out
 *   negative, clamp to zero, and report the entire block as time given back:
 *   a 45-minute block that hands back "+45m free" is nonsense, and several of
 *   them land on the same minute and pile up on screen.
 *
 * · Running — it took from its start until now, and any unused remainder is
 *   genuine slack.
 *
 * · Already past its planned end — it took what it was given, no more. We
 *   have no evidence it ran longer, so we do not invent any.
 */
export function closeBlock(
  block: Block,
  placedStartMin: number,
  nowMin: number,
): Block {
  const start = placedStartMin;
  const plannedEnd = start + block.plannedMin;
  const end = nowMin <= start ? plannedEnd : Math.min(nowMin, plannedEnd);

  return {
    ...block,
    status: "done",
    actualStartMin: start,
    actualEndMin: end,
  };
}

/** Undo a close, returning the block to the plan. */
export function reopenBlock(block: Block): Block {
  return {
    ...block,
    status: "planned",
    actualStartMin: null,
    actualEndMin: null,
  };
}

/**
 * Begin a block now.
 *
 * The clock the block is measured against becomes the real one: it is running
 * from this minute, whatever the plan said, and it is what going long is
 * measured from. Until this existed the app could describe a day but never
 * witness one — `status: "active"` was unreachable, and with it every warning
 * about running over.
 */
export function startBlock(block: Block, nowMin: number): Block {
  return {
    ...block,
    status: "active",
    actualStartMin: nowMin,
    actualEndMin: null,
  };
}

/**
 * Put a running block down without finishing it.
 *
 * Used when another block is started while this one runs: the minutes it did
 * get are real and are kept, so the day's record stays true. Reopening it
 * puts it back in the plan.
 */
export function pauseBlock(block: Block, nowMin: number): Block {
  const start = block.actualStartMin ?? nowMin;
  return {
    ...block,
    status: "done",
    actualStartMin: start,
    actualEndMin: Math.max(start, nowMin),
  };
}

/**
 * The same block, ready to live on another day.
 *
 * Its routine is deliberately dropped: a carried copy that still claimed to
 * belong to a routine would collide with the block that routine grows on the
 * day it lands on, and one of the two would be refused by the database.
 */
export function carriedCopy(block: Block): Omit<Block, "id" | "sortOrder"> {
  return {
    title: block.title,
    kind: block.kind,
    startMin: block.startMin,
    plannedMin: block.plannedMin,
    status: "planned",
    threadId: block.threadId,
    actualStartMin: null,
    actualEndMin: null,
    routineId: null,
    // The copy is the same block on another day, so it keeps its face.
    colorIndex: block.colorIndex ?? null,
    icon: block.icon ?? null,
  };
}
