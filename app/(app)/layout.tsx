import { TabBar } from "@/components/TabBar";

/* The tabbed shell. Login, the auth callback and the design bench sit outside
   this group, so they get no tab bar. */

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex-1">{children}</div>
      <div className="sticky bottom-0 z-30">
        <TabBar />
      </div>
    </div>
  );
}
