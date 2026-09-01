"use client";

import { TabBar } from "@/components/TabBar";
import { useKeyboardInset } from "@/lib/useKeyboardInset";

/* The tabbed shell. Login, the auth callback and the design bench sit outside
   this group, so they get no tab bar.

   A client component only because of the hook: the keyboard's height is
   written once, here, to a CSS variable that both bottom bars read. Measuring
   it in each screen instead would mean two observers disagreeing about where
   the bottom of the window is, which is the shape the bug took. */

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useKeyboardInset();

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
