export interface Thread {
  id: string;
  name: string;
  /** 0–7, indexing the thread palette in styles/tokens.css. */
  colorIndex: number;
  /** Minutes a week this goal is meant to get. Null means no commitment. */
  weeklyTargetMin?: number | null;
}

export const THREAD_COLOR_COUNT = 8;

/** CSS colour for a thread. Wraps rather than throwing on a stray index. */
export function threadColor(colorIndex: number): string {
  const i = ((colorIndex % THREAD_COLOR_COUNT) + THREAD_COLOR_COUNT) %
    THREAD_COLOR_COUNT;
  return `var(--color-thread-${i + 1})`;
}

export function threadById(
  threads: Thread[],
  id: string | null,
): Thread | null {
  if (!id) return null;
  return threads.find((t) => t.id === id) ?? null;
}
