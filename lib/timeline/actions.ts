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
