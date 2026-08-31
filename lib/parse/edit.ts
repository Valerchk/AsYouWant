/* ==========================================================================
   Editing the composer's text from its chips.
   --------------------------------------------------------------------------
   The composer keeps one string as the source of truth, so that typing
   "45m" and tapping the 45m chip cannot disagree with each other. A chip
   therefore does not hold state of its own — it rewrites the token it owns,
   in place, and leaves everything else in the string alone.

   Ranges come from the parser rather than from a second set of regexes:
   two independent readings of the same string is exactly how a chip ends up
   editing the wrong four characters.
   ========================================================================== */

import { formatClock } from "@/lib/time";
import { parseQuickAdd, type ParseToken } from "./quickAdd";

/** "45m", "1h", "1h30" — written so the parser reads back the same number. */
export function durationToken(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${rest}`;
}

export function setDuration(input: string, minutes: number): string {
  return setToken(input, "duration", durationToken(minutes));
}

/** Null clears the time, which is what makes the block flow again. */
export function setTime(input: string, startMin: number | null): string {
  return setToken(input, "time", startMin === null ? null : formatClock(startMin));
}

/** Picking a goal from the list supersedes any #tag that was typed. */
export function stripThread(input: string): string {
  return setToken(input, "thread", null);
}

function setToken(
  input: string,
  type: ParseToken["type"],
  text: string | null,
): string {
  const { tokens } = parseQuickAdd(input);
  const token = tokens.find((t) => t.type === type);

  if (token) {
    return tidy(`${input.slice(0, token.start)}${text ?? ""}${input.slice(token.end)}`);
  }
  if (text === null) return input;

  // Appended with a trailing space: the caret lands at the end, and without
  // it the next character typed would fuse onto the token just inserted.
  return tidy(`${input.replace(/ +$/, "")} ${text} `);
}

/** Close the gap a removed token leaves, without eating the trailing space. */
function tidy(s: string): string {
  return s.replace(/ {2,}/g, " ").replace(/^ +/, "");
}
