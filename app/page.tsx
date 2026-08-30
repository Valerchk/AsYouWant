import Link from "next/link";
import type { Metadata } from "next";
import { RibbonDemo } from "@/components/landing/RibbonDemo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Icon } from "@/components/icons/Icon";

/* The landing page. Signed-in visitors never see it: proxy.ts sends them
   straight to /today. */

export const metadata: Metadata = {
  title: "As You Want — a day that reshapes itself",
  description:
    "Most plans survive two hours. This one bends: finish early and the day pulls up, run long and it tells you what no longer fits.",
};

function Rule() {
  return <div className="my-16 h-px bg-rule sm:my-20" />;
}

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="safe-top mx-auto flex max-w-4xl items-center justify-between px-6 pt-6">
        <span className="display text-lede text-deep">As You Want</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-edge px-3 py-2 text-fine text-ink transition-colors hover:bg-sunk"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6">
        {/* ---- hero ------------------------------------------------------ */}
        <section className="grid gap-12 pt-16 sm:pt-24 md:grid-cols-[1.1fr_1fr] md:gap-16">
          <div>
            <h1 className="display text-[clamp(2.25rem,7vw,3.5rem)] leading-[1.02] tracking-[-0.035em] text-deep">
              A day that
              <br />
              reshapes itself.
            </h1>

            <p className="mt-6 max-w-md text-lede leading-7 text-ink">
              Most plans survive about two hours. Something runs long, the rest
              slides, and the schedule quietly starts lying to you.
            </p>
            <p className="mt-4 max-w-md text-base leading-7 text-faint">
              This one bends instead. Finish early and the day pulls up. Run
              long and it says plainly what no longer fits — rather than
              pretending everything still does.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-edge bg-accent px-5 py-3 text-base text-paper transition-shadow hover:shadow-lift"
              >
                Start planning
                <Icon name="chevron" size={15} />
              </Link>
              <span className="text-fine text-faint">
                No password. A link to your email.
              </span>
            </div>
          </div>

          {/* The demo carries the argument; it runs on its own. */}
          <div className="rounded-plate bg-sunk/50 p-5 ring-1 ring-rule">
            <RibbonDemo />
          </div>
        </section>

        <Rule />

        {/* ---- the two kinds of block ------------------------------------ */}
        <section className="grid gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <div className="mb-3 flex items-center gap-2 text-accent">
              <Icon name="anchor" size={17} />
              <h2 className="text-lede text-deep">Anchors hold</h2>
            </div>
            <p className="text-base leading-7 text-ink">
              A meeting at eleven is at eleven. Anchored blocks never move, and
              everything elastic arranges itself around them.
            </p>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-accent">
              <Icon name="flow" size={17} />
              <h2 className="text-lede text-deep">Everything else flows</h2>
            </div>
            <p className="text-base leading-7 text-ink">
              Work that could happen any time finds its own place between the
              anchors — in the order you meant, never rearranged behind your
              back to save a few minutes.
            </p>
          </div>
        </section>

        <Rule />

        {/* ---- threads --------------------------------------------------- */}
        <section className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-center md:gap-16">
          <div>
            <div className="mb-3 flex items-center gap-2 text-accent">
              <Icon name="thread" size={17} />
              <h2 className="text-lede text-deep">Goals run through the day</h2>
            </div>
            <p className="text-base leading-7 text-ink">
              Every block can sit on a thread — a goal that runs down the whole
              day beside your work. You can see at a glance which one today is
              actually feeding.
            </p>
            <p className="mt-4 text-base leading-7 text-faint">
              A busy day and a useful day look completely different here, and
              that is the point.
            </p>
          </div>

          <div className="flex gap-1.5 rounded-plate bg-sunk/50 p-6 ring-1 ring-rule">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-1.5 rounded-plate"
                  style={{
                    height: [96, 40, 132, 24, 68][n - 1],
                    background: `var(--color-thread-${n})`,
                    opacity: n === 4 ? 0.35 : 1,
                  }}
                />
                <span className="text-micro text-faint">
                  {["Thesis", "Work", "Craft", "Reading", "Health"][n - 1]}
                </span>
              </div>
            ))}
          </div>
        </section>

        <Rule />

        {/* ---- the live card --------------------------------------------- */}
        <section className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-16">
          <div>
            <div className="mb-3 flex items-center gap-2 text-accent">
              <Icon name="bell" size={17} />
              <h2 className="text-lede text-deep">One card, not a stream</h2>
            </div>
            <p className="text-base leading-7 text-ink">
              A single notification stays on your lock screen and quietly
              rewrites itself as the day moves. It never stacks, never piles up,
              and never asks for anything.
            </p>
            <p className="mt-4 text-base leading-7 text-faint">
              It speaks up only when it matters: a block running long, a meeting
              that came and went, the day closing.
            </p>
          </div>

          {/* A lock-screen card, drawn rather than screenshotted. */}
          <div className="rounded-plate bg-sunk/50 p-6 ring-1 ring-rule">
            <div className="rounded-plate bg-paper p-4 shadow-lift">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-edge bg-accent">
                  <span className="block h-3.5 w-[3px] bg-paper" />
                </div>
                <div className="min-w-0">
                  <div className="num text-fine text-deep">
                    Deep work · 25m left
                  </div>
                  <div className="mt-1 text-fine text-faint">
                    then Standup 11:00
                  </div>
                </div>
                <span className="num ml-auto shrink-0 text-micro text-faint">
                  now
                </span>
              </div>
            </div>
            <p className="mt-3 text-micro text-faint">
              On iPhone, add the app to your Home Screen and reminders arrive
              like any other app&rsquo;s.
            </p>
          </div>
        </section>

        <Rule />

        {/* ---- close ----------------------------------------------------- */}
        <section className="pb-24 text-center">
          <h2 className="display text-title text-deep">
            Plan the day you will actually have.
          </h2>
          <Link
            href="/login"
            className="mt-7 inline-flex items-center gap-2 rounded-edge bg-accent px-5 py-3 text-base text-paper transition-shadow hover:shadow-lift"
          >
            Start planning
            <Icon name="chevron" size={15} />
          </Link>
        </section>
      </main>

      <footer className="safe-bottom border-t border-rule">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6 text-micro text-faint">
          <span>As You Want</span>
          <Link href="/login" className="transition-colors hover:text-ink">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
