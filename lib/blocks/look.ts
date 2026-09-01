import { threadColor, type Thread } from "@/lib/threads";
import type { Block } from "@/lib/timeline/engine";

/* ==========================================================================
   What a block looks like.
   --------------------------------------------------------------------------
   A block carries its own colour and icon. If it has neither, and it belongs
   to a goal, it borrows the goal's — which is what keeps every day that was
   planned before this existed looking exactly as it did.

   Order matters and only one rule governs it: the more specific statement
   wins. Saying "this block is amber" is more specific than "this block is
   part of Work", so it takes precedence, and it does so per field: a block
   may set its own colour and still show its goal's icon.
   ========================================================================== */

export interface Look {
  /** 0–15 into the palette, or null for no colour of its own. */
  colorIndex: number | null;
  /** A name from GOAL_ICONS, or null. */
  icon: string | null;
}

/** What to paint this block with, given the goal it is part of (if any). */
export function blockLook(
  block: Pick<Block, "colorIndex" | "icon">,
  thread: Thread | null,
): Look {
  return {
    // `??` and not `||`: colour 0 is ochre, not "unset". `||` here silently
    // sent every block wearing the first colour back to its goal's.
    colorIndex: block.colorIndex ?? thread?.colorIndex ?? null,
    icon: block.icon ?? thread?.icon ?? null,
  };
}

/** The CSS colour for a look, or null when it has none. */
export function lookColor(look: Look): string | null {
  return look.colorIndex === null ? null : threadColor(look.colorIndex);
}

/** True when this block says nothing about how it should look. */
export function isPlain(look: Look): boolean {
  return look.colorIndex === null && look.icon === null;
}
