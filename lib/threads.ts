export interface Thread {
  id: string;
  name: string;
  /** 0–15, indexing the thread palette in styles/tokens.css. */
  colorIndex: number;
  /** Minutes a week this goal is meant to get. Null means no commitment. */
  weeklyTargetMin?: number | null;
  /** A name from GOAL_ICONS, or null for the plain stroke. */
  icon?: string | null;
}

export const THREAD_COLOR_COUNT = 16;

/**
 * CSS colour for a thread. Wraps rather than throwing on a stray index.
 *
 * Deliberately `--thread-N` and not the `--color-thread-N` alias that
 * Tailwind's `@theme inline` block creates. That alias is tree-shaken: any
 * theme variable no generated utility references is dropped from the build,
 * and a name assembled at runtime is invisible to the scanner. Thirteen of
 * the sixteen goal colours were missing from production CSS — rails, palette
 * swatches and block fills all painting with nothing — while the three that
 * happened to appear as literals in the landing page's demo survived and hid
 * the fault. The raw variables live in plain `:root` blocks and always ship.
 */
export function threadColor(colorIndex: number): string {
  const i = ((colorIndex % THREAD_COLOR_COUNT) + THREAD_COLOR_COUNT) %
    THREAD_COLOR_COUNT;
  return `var(--thread-${i + 1})`;
}

export function threadById(
  threads: Thread[],
  id: string | null,
): Thread | null {
  if (!id) return null;
  return threads.find((t) => t.id === id) ?? null;
}
