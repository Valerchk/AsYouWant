import type { ReactElement } from "react";

/* ==========================================================================
   Drafting set — 24×24, 1.5px, butt caps, mitre joins.
   --------------------------------------------------------------------------
   Rules that hold across every glyph, because consistency is the only thing
   that makes a hand-drawn set read as a set:
     · straight lines and true circular arcs only — no freehand béziers
     · no rounded caps or joins: this is a drawn instrument, not a sticker
     · strokes never scale (see `[data-icon] *` in globals.css), so a 16px
       icon and a 40px icon share the same hairline weight
   ========================================================================== */

const PATHS = {
  /* A block pinned to a time. Crossbar, shank, flukes — read as an anchor
     at a glance, built from two lines and one arc. */
  anchor: (
    <>
      <path d="M12 4v16" />
      <path d="M7 8h10" />
      <path d="M5 13a7 7 0 0 0 14 0" />
    </>
  ),

  /* An elastic block. Two currents running between the anchors. */
  flow: (
    <>
      <path d="M3 9a3 3 0 0 1 6 0 3 3 0 0 0 6 0 3 3 0 0 1 6 0" />
      <path d="M3 16a3 3 0 0 1 6 0 3 3 0 0 0 6 0 3 3 0 0 1 6 0" />
    </>
  ),

  /* A goal: one continuous line through the day, knotted where work lands. */
  thread: (
    <>
      <path d="M12 3v6" />
      <path d="M12 15v6" />
      <path d="M15 12a3 3 0 0 1-6 0 3 3 0 0 1 6 0" />
    </>
  ),

  check: <path d="M4 12l5 5 11-11" />,

  /* Won't fit today: the block is pushed until it hits the end of the day. */
  overflow: (
    <>
      <path d="M4 12h11" />
      <path d="M12 8l4 4-4 4" />
      <path d="M20 5v14" />
    </>
  ),

  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),

  /* Commit what is in the field. Points up because the composer sits at the
     bottom of the screen and the day it feeds is above it. */
  arrowUp: (
    <>
      <path d="M12 19V6" />
      <path d="M6 12l6-6 6 6" />
    </>
  ),

  clock: (
    <>
      <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),

  /* Duration: a measured span between two end marks. */
  duration: (
    <>
      <path d="M4 6v12" />
      <path d="M20 6v12" />
      <path d="M4 12h16" />
    </>
  ),

  chevron: <path d="M9 6l6 6-6 6" />,

  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),

  bell: (
    <>
      <path d="M6 17v-5a6 6 0 0 1 12 0v5" />
      <path d="M4 17h16" />
      <path d="M10 20h4" />
    </>
  ),

  /* Deliberately mirrors the iOS system Share glyph. InstallGate points at
     this exact shape in the Safari toolbar, so an approximation would send
     people hunting for the wrong button. */
  share: (
    <>
      <path d="M12 15V3" />
      <path d="M8.5 6.5L12 3l3.5 3.5" />
      <path d="M7 10H5v11h14V10h-2" />
    </>
  ),

  /* The day collapsed into a cut cable: ring thickness is where time went. */
  crossSection: (
    <>
      <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0" />
      <path d="M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0" />
      <path d="M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0" />
    </>
  ),

  template: (
    <>
      <path d="M4 4h16v16H4z" />
      <path d="M4 9h16" />
      <path d="M9 9v11" />
    </>
  ),

  drag: (
    <>
      <path d="M6 10h12" />
      <path d="M6 14h12" />
    </>
  ),

  sunrise: (
    <>
      <path d="M3 18h18" />
      <path d="M7 18a5 5 0 0 1 10 0" />
      <path d="M12 3v3" />
      <path d="M4.5 7.5l2 2" />
      <path d="M19.5 7.5l-2 2" />
    </>
  ),

  moon: <path d="M19.5 15.5A8 8 0 1 1 8.5 4.5a6.5 6.5 0 0 0 11 11z" />,

  /* Follow the system: a disc split down its diameter — half day, half night. */
  auto: (
    <>
      <path d="M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0" />
      <path d="M12 4v16" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 24,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      data-icon={name}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
