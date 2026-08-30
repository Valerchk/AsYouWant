import type { ReactElement } from "react";

/* ==========================================================================
   Goal icons — same drafting rules as the interface set.
   --------------------------------------------------------------------------
   24×24, 1.5px, butt caps, mitre joins, straight lines and true arcs only.
   Kept separate from Icon.tsx because these are content, not chrome: a person
   picks one, and the set will grow. Chrome icons never do.
   ========================================================================== */

const GOAL_PATHS = {
  /* A desk with a screen on it. */
  work: (
    <>
      <path d="M5 4h14v10H5z" />
      <path d="M3 18h18" />
      <path d="M10 14v4M14 14v4" />
    </>
  ),

  /* An open book. */
  study: (
    <>
      <path d="M12 6v14" />
      <path d="M12 6C10 4 6 4 3 5v13c3-1 7-1 9 1" />
      <path d="M12 6c2-2 6-2 9-1v13c-3-1-7-1-9 1" />
    </>
  ),

  /* A dumbbell. */
  sport: (
    <>
      <path d="M4 8v8M7 6v12M17 6v12M20 8v8" />
      <path d="M7 12h10" />
    </>
  ),

  /* A crescent — rest. */
  sleep: <path d="M19.5 15.5A8 8 0 1 1 8.5 4.5a6.5 6.5 0 0 0 11 11z" />,

  /* A house. */
  home: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),

  /* A brush, angled. */
  craft: (
    <>
      <path d="M14 3l7 7-9 9H5v-7z" />
      <path d="M11 6l7 7" />
    </>
  ),

  /* Stacked pages. */
  read: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h7M9 16h7" />
    </>
  ),

  /* A coin. */
  money: (
    <>
      <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0" />
      <path d="M12 7v10" />
      <path d="M14.5 9.5h-4a1.75 1.75 0 0 0 0 3.5h3a1.75 1.75 0 0 1 0 3.5h-4" />
    </>
  ),

  /* Two figures. */
  people: (
    <>
      <path d="M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
      <path d="M3 20v-2a4 4 0 0 1 4-4h1a4 4 0 0 1 4 4v2" />
      <path d="M16 6.5a2.5 2.5 0 1 1 0 5" />
      <path d="M15 14h1a4 4 0 0 1 4 4v2" />
    </>
  ),

  /* A signpost on a road. */
  travel: (
    <>
      <path d="M7 3v18" />
      <path d="M7 5h11l-2.5 3L18 11H7" />
    </>
  ),

  /* A fork and a knife. */
  food: (
    <>
      <path d="M7 3v7a2 2 0 0 0 4 0V3" />
      <path d="M9 10v11" />
      <path d="M16 3c2 1 3 3 3 6s-1 4-2 4v8" />
    </>
  ),

  /* A single note. */
  music: (
    <>
      <path d="M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
      <path d="M9 18V5l11-2v13" />
      <path d="M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
    </>
  ),

  /* Angle brackets. */
  code: (
    <>
      <path d="M8 7l-5 5 5 5" />
      <path d="M16 7l5 5-5 5" />
      <path d="M13 4l-2 16" />
    </>
  ),

  /* A pen nib. */
  write: (
    <>
      <path d="M4 20l1.5-5L16 4.5 19.5 8 9 18.5z" />
      <path d="M14 6.5L17.5 10" />
      <path d="M5.5 15L9 18.5" />
    </>
  ),

  /* A tree. */
  nature: (
    <>
      <path d="M12 21v-6" />
      <path d="M12 15l-5-4h3L6 7h3l3-4 3 4h3l-4 4h3z" />
    </>
  ),

  /* A basket. */
  shop: (
    <>
      <path d="M4 8h16l-1.5 12h-13z" />
      <path d="M9 8V5a3 3 0 0 1 6 0v3" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type GoalIconName = keyof typeof GOAL_PATHS;

export const GOAL_ICONS = Object.keys(GOAL_PATHS) as GoalIconName[];

export function isGoalIcon(name: string | null | undefined): name is GoalIconName {
  return !!name && name in GOAL_PATHS;
}

export function GoalIcon({
  name,
  size = 20,
  className,
  style,
}: {
  name: GoalIconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      data-icon={`goal-${name}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {GOAL_PATHS[name]}
    </svg>
  );
}
