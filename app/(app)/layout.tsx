import { TabBar } from "@/components/TabBar";

/* The tabbed shell. Login, the auth callback and the design bench sit outside
   this group, so they get no tab bar.

   No keyboard handling here, and that is the fix rather than an omission. The
   composer and the tab bar are both plain fixed elements; iOS raises them over
   its own keyboard, and two successive attempts to measure and correct that
   from JavaScript each made it worse — see the note in globals.css. */

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
