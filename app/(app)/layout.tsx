"use client";

import { TabBar } from "@/components/TabBar";
import { useKeyboardSettle } from "@/lib/useKeyboardSettle";

/* The tabbed shell. Login, the auth callback and the design bench sit outside
   this group, so they get no tab bar.

   The keyboard hook sits here rather than inside TabBar because this is where
   its reach is legible: every screen in this group — the day, the inbox, the
   goals, the review, the settings — has fields, and every one of them has the
   two fixed bars at the bottom that a stranded scroll leaves hanging. Buried
   in a component that merely happens to render everywhere, nobody could tell
   which screens it covered.

   It positions nothing. See lib/useKeyboardSettle for why that restraint is
   the whole point: two earlier attempts moved the bars themselves and each
   made things worse. */

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useKeyboardSettle();

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1">{children}</div>
      {/* The tab bar is fixed, so this stands in for the room it would have
          taken. Without it the last line of every screen ends underneath. */}
      <div className="tabbar-gap shrink-0" aria-hidden />
      <TabBar />
    </div>
  );
}
